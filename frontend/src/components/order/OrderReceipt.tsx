// src/components/order/OrderReceipt.tsx
// Reçu d'achat imprimable + téléchargeable en PDF.
// Fonctionne via html2canvas + jsPDF (côté client, pas de backend nécessaire).

import { useRef, useState } from "react";
import { FiDownload, FiX, FiLoader } from "react-icons/fi";
import type { Order } from "../../types";

// ── Dépendances à installer ──────────────────────────────────────────────────
// npm install html2canvas jspdf
// npm install --save-dev @types/html2canvas

interface OrderReceiptProps {
  order: Order;
  onClose: () => void;
}

const COMPANY = {
  name: "SmartShop",
  tagline: "Système intelligent d'aide à la décision",
  address: "Tunis, Tunisie",
  email: "contact@smartshop.tn",
  phone: "+216 XX XXX XXX",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Paiement à la livraison",
  MOBILE: "Paiement mobile (i-Dinar)",
  CARD: "Carte bancaire",
};

export default function OrderReceipt({ order, onClose }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const subtotal = parseFloat(String(order.subtotal));
  const shipping = parseFloat(String(order.shipping_cost));
  const tva = parseFloat(String(order.tva_timbre ?? 1));
  const total = parseFloat(String(order.total_amount));
  const now = new Date();

  // ── Téléchargement PDF (CORRIGÉ) ──────────────────────────────────────────
  // Approche : html2canvas capture le div du reçu → jsPDF crée un PDF
  // Pourquoi cette approche ?
  //   - window.print() ouvre la boîte de dialogue d'impression du navigateur,
  //     ce qui n'est PAS un téléchargement automatique
  //   - Pour un téléchargement direct (.pdf), il faut générer le PDF côté client
  //   - html2canvas convertit le HTML/CSS en image canvas (screenshot du composant)
  //   - jsPDF intègre cette image dans un document PDF A4
  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);

    try {
      // Import dynamique pour ne pas alourdir le bundle initial
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      // Capture du composant en image haute résolution
      // scale: 2 → resolution double (évite le flou sur les écrans Retina)
      // useCORS: true → autorise les images cross-origin (photos produits)
      // backgroundColor: '#ffffff' → fond blanc (sinon transparent = noir en PDF)
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");

      // Création du PDF A4 portrait
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Calcul des dimensions pour faire tenir l'image dans A4
      const imgWidth = pageWidth - 20; // marges de 10mm de chaque côté
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yPos = 10; // position Y de départ (marge haut)

      // Si le contenu dépasse une page → découper en plusieurs pages
      if (imgHeight <= pageHeight - 20) {
        pdf.addImage(imgData, "PNG", 10, yPos, imgWidth, imgHeight);
      } else {
        // Contenu multi-pages : découper le canvas en tranches
        const pageContentHeight = pageHeight - 20;
        let remainingHeight = imgHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
          const sliceHeight = Math.min(pageContentHeight, remainingHeight);

          // Créer un canvas temporaire pour la tranche
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = (sliceHeight / imgHeight) * canvas.height;

          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(
            canvas,
            0,
            sourceY, // source x, y
            canvas.width,
            sliceCanvas.height, // source width, height
            0,
            0, // dest x, y
            sliceCanvas.width,
            sliceCanvas.height, // dest width, height
          );

          const sliceData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", 10, yPos, imgWidth, sliceHeight);

          remainingHeight -= pageContentHeight;
          sourceY += sliceCanvas.height;

          if (remainingHeight > 0) {
            pdf.addPage();
            yPos = 10;
          }
        }
      }

      // Téléchargement automatique du PDF
      // filename format : recu-SS-2024-0042-20260407.pdf
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `recu-${order.order_number}-${dateStr}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Erreur génération PDF :", error);
      // Fallback : ouvrir la boîte d'impression navigateur
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {/* ── Styles impression (pour window.print()) ── */}
      <style>{`
        @media print {
          body > *:not(.receipt-portal) { display: none !important; }
          .receipt-portal { 
            display: block !important; 
            position: fixed; 
            inset: 0; 
            z-index: 9999; 
            background: white; 
          }
          .receipt-no-print { display: none !important; }
          .receipt-content { 
            box-shadow: none !important; 
            border: none !important; 
            max-width: 100% !important; 
          }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>

      {/* ── Overlay ── */}
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 receipt-portal">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto receipt-content">
          {/* Barre d'actions */}
          <div className="flex items-center justify-between px-6 py-4 border-b receipt-no-print">
            <h2 className="font-bold text-[16px] text-gray-800">
              Reçu de commande
            </h2>
            <div className="flex gap-2">
              {/* Bouton Imprimer */}

              {/* Bouton Télécharger PDF (NOUVEAU) */}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-gognet-orange text-gognet-dark
                           px-4 py-2 rounded-lg text-[13px] font-bold 
                           hover:bg-gognet-orange/90 transition-colors
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <FiLoader size={14} className="animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <FiDownload size={14} /> Télécharger PDF
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                title="Fermer"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* ── Corps du reçu (capturé par html2canvas) ── */}
          {/* IMPORTANT : ref={receiptRef} = seul ce div sera capturé, pas toute la page */}
          <div
            ref={receiptRef}
            className="px-8 py-6 text-[13px] text-gray-800 bg-white"
          >
            {/* En-tête société */}
            <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
              <div>
                <h1 className="text-[22px] font-black tracking-tight">
                  <span className="text-gray-900">smart</span>
                  <span className="text-amber-500">shop</span>
                  <sup className="text-[11px] text-amber-500 font-black ml-0.5">
                    ML
                  </sup>
                </h1>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {COMPANY.tagline}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {COMPANY.address} · {COMPANY.email} · {COMPANY.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold">
                  Reçu d'achat
                </p>
                <p className="text-[18px] font-black text-gray-900 mt-0.5">
                  {order.order_number}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Émis le{" "}
                  {now.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  {" à "}
                  {now.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Statut + dates */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {/* <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                  Statut
                </p>
                <p className="font-bold text-gray-800">
                  {STATUS_LABELS[order.status] ?? order.status}
                </p>
              </div> */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                  Date de commande
                </p>
                <p className="font-medium">
                  {new Date(order.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              {order.delivery_date && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                    Livraison prévue
                  </p>
                  <p className="font-medium">
                    {new Date(order.delivery_date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Adresse + paiement */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {order.shipping_full_name && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">
                    Livraison à
                  </p>
                  <p className="font-semibold">{order.shipping_full_name}</p>
                  <p className="text-gray-600">{order.shipping_phone}</p>
                  <p className="text-gray-600">{order.shipping_address_line}</p>
                  <p className="text-gray-600">
                    {order.shipping_postal_code} {order.shipping_city}
                  </p>
                  <p className="text-gray-600">{order.shipping_country}</p>
                </div>
              )}
              {order.payment && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">
                    Paiement
                  </p>
                  <p className="font-semibold">
                    {PAYMENT_LABELS[order.payment.method] ??
                      order.payment.method}
                  </p>
                  <p
                    className={`text-[12px] font-medium mt-0.5 ${
                      order.payment.status === "COMPLETED"
                        ? "text-green-600"
                        : order.payment.status === "FAILED"
                          ? "text-red-500"
                          : "text-amber-600"
                    }`}
                  >
                    {order.payment.status_display}
                  </p>
                </div>
              )}
            </div>

            {/* Tableau des articles */}
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b-2 border-gray-200 text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="text-left py-2 font-semibold">Produit</th>
                  <th className="text-center py-2 font-semibold w-16">Qté</th>
                  <th className="text-right py-2 font-semibold w-24">
                    Prix unit.
                  </th>
                  <th className="text-right py-2 font-semibold w-24">
                    Sous-total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const price = parseFloat(String(item.unit_price));
                  const sub = price * item.quantity;
                  return (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-gray-800">
                          {item.product_name}
                        </p>
                      </td>
                      <td className="py-2.5 text-center text-gray-600">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">
                        {price.toFixed(3)} DT
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        {sub.toFixed(3)} DT
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totaux */}
            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-1.5 text-[12px]">
                <div className="flex justify-between text-gray-500">
                  <span>Sous-total HT</span>
                  <span>{subtotal.toFixed(3)} DT</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Frais de livraison</span>
                  <span>
                    {shipping === 0 ? "Gratuit" : `${shipping.toFixed(3)} DT`}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>TVA / Timbre fiscal</span>
                  <span>{tva.toFixed(3)} DT</span>
                </div>
                <div className="flex justify-between font-bold text-[15px] border-t border-gray-300 pt-2 mt-1">
                  <span>Total TTC</span>
                  <span className="text-red-600">{total.toFixed(3)} DT</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-[12px]">
                <p className="font-semibold text-amber-800 mb-0.5">Note :</p>
                <p className="text-amber-700 italic">{order.notes}</p>
              </div>
            )}

            {/* Pied de page */}
            <div className="border-t border-gray-200 pt-4 text-center text-[11px] text-gray-400 space-y-1">
              <p>
                Merci pour votre confiance. Ce reçu fait foi de votre achat sur
                SmartShop.
              </p>
              <p>
                Pour tout litige ou retour, conservez ce document jusqu'à la
                livraison.
              </p>
              <p className="font-medium text-gray-500">
                SmartShop ML · {COMPANY.address} · {COMPANY.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
