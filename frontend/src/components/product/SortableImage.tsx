// src/components/admin/SortableImage.tsx
//
// Composant wrapper qui rend une image draggable via @dnd-kit/sortable.
//
// POURQUOI ce composant est nécessaire :
//   DndContext + SortableContext créent le "conteneur" de drag.
//   Mais chaque item doit lui-même s'enregistrer en appelant useSortable(id).
//   Sans ça, le contexte existe mais les divs sont des éléments HTML normaux
//   — dnd-kit ne les connaît pas et ne peut pas les déplacer.
//
// useSortable() retourne :
//   - attributes  : aria-* pour l'accessibilité (aria-roledescription, etc.)
//   - listeners   : onPointerDown / onKeyDown pour déclencher le drag
//   - setNodeRef  : ref à attacher à l'élément DOM racine
//   - transform   : déplacement CSS pendant le drag (calculé par dnd-kit)
//   - transition  : transition CSS pour l'animation de retour
//   - isDragging  : true pendant le drag (pour le style visuel)

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableImageProps {
  id: string; // identifiant unique de l'item (= index.toString())
  src: string; // URL de prévisualisation (URL.createObjectURL)
  name: string; // nom du fichier (pour alt)
  onRemove: () => void; // callback pour supprimer cet item
}

export default function SortableImage({
  id,
  src,
  name,
  onRemove,
}: SortableImageProps) {
  const {
    attributes, // props aria pour l'accessibilité
    listeners, // événements pointeur/clavier qui déclenchent le drag
    setNodeRef, // ref DOM — dnd-kit doit connaître l'élément physique
    transform, // { x, y, scaleX, scaleY } calculé pendant le drag
    transition, // "transform 200ms ease" ou undefined
    isDragging, // true pendant le drag actif
  } = useSortable({ id });

  // CSS.Transform.toString() convertit l'objet transform en string CSS
  // ex: "translate3d(0px, -48px, 0)"
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1, // l'item "fantôme" pendant le drag
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none", // obligatoire pour le drag sur mobile
  };

  return (
    <div
      ref={setNodeRef} // ← enregistre cet élément DOM auprès de dnd-kit
      style={style}
      {...attributes} // ← aria-roledescription="sortable" etc.
      className="relative w-20 h-20 border-2 border-dashed border-gray-300
                 rounded overflow-hidden select-none hover:border-blue-400
                 transition-colors"
    >
      {/* Zone de drag : toute l'image sauf le bouton × */}
      <div
        {...listeners} // ← onPointerDown déclenche le drag
        className="w-full h-full"
      >
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover pointer-events-none"
        />
        {/* Icône grip pour signaler que c'est draggable */}
        <div className="absolute bottom-1 left-1 opacity-60">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="2" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
          </svg>
        </div>
      </div>

      {/* Bouton suppression — stopPropagation pour ne pas déclencher le drag */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-0 right-0 bg-red-500 hover:bg-red-600
                   text-white w-5 h-5 text-xs flex items-center justify-center
                   transition-colors z-10"
        aria-label="Supprimer cette image"
      >
        ×
      </button>
    </div>
  );
}
