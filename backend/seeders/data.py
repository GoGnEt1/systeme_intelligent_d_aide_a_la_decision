CATEGORIES_DATA = {
    "Électronique": [
        "Smartphones",
        "Ordinateurs Portables",
        "Accessoires Informatiques",
        "Écrans & Moniteurs",
        "Audio",
        "Appareils Photo",
        "Gaming",
        "Tablettes",
        "Objets Connectés",
    ],
    "Maison": [ 
        "Cuisine Connectée", 
        "Smart Home", 
        "Préparation culinaire", 
    ], 
    "Électromenager": [ 
        "Préparation culinaire", 
        "Climatisation", 
        "Cuisson", 
    ],
}

PRODUCTS_DATA  = {
    "Smartphones": [
        {
            "name": "Samsung Galaxy A54 5G 128Go",
            "price": 1299.000,
            "original_price": 1499.000,
            "stock": 32,
            "description": """
Smartphone Samsung Galaxy A54 5G avec écran Super AMOLED 6.4 pouces 120Hz,
processeur Exynos 1380, caméra triple 50MP et batterie 5000mAh.
            """,
        },

        {
            "name": "iPhone 15 128Go",
            "price": 3499.000,
            "original_price": 3799.000,
            "stock": 12,
            "description": """
Apple iPhone 15 avec puce A16 Bionic, écran Super Retina XDR,
caméra principale 48MP et port USB-C.
            """,
        },

        {
            "name": "Xiaomi Redmi Note 13 Pro",
            "price": 1199.000,
            "original_price": 1399.000,
            "stock": 40,
            "description": """
Xiaomi Redmi Note 13 Pro avec capteur 200MP,
écran AMOLED 120Hz et charge rapide 67W.
            """,
        },
    ],

    "Ordinateurs Portables": [
        {
            "name": "MacBook Air M2 13 pouces",
            "price": 4999.000,
            "original_price": 5499.000,
            "stock": 8,
            "description": """
MacBook Air avec puce Apple M2,
8Go RAM, SSD 256Go et autonomie jusqu’à 18h.
            """,
        },

        {
            "name": "Lenovo IdeaPad 3 Ryzen 7",
            "price": 2299.000,
            "original_price": 2499.000,
            "stock": 18,
            "description": """
PC portable Lenovo IdeaPad 3 équipé d’un Ryzen 7,
16Go RAM et SSD NVMe 512Go.
            """,
        },
    ],

    # =========================================================
    # ACCESSOIRES INFORMATIQUES
    # =========================================================

    "Accessoires Informatiques": [

        {
            "name": "Clavier Mécanique Redragon K552 RGB",
            "price": 189.000,
            "original_price": 229.000,
            "stock": 24,
            "description": """
Clavier mécanique gaming Redragon K552 avec switches bleus,
rétroéclairage RGB multicolore, structure métallique robuste
et anti-ghosting complet.
            """,
        },

        {
            "name": "Souris Logitech G305 Lightspeed",
            "price": 169.000,
            "original_price": 199.000,
            "stock": 38,
            "description": """
Souris gaming sans fil Logitech G305 équipée du capteur HERO 12000 DPI,
connexion Lightspeed ultra rapide et autonomie jusqu’à 250 heures.
            """,
        },
    ],

    # =========================================================
    # ÉCRANS & MONITEURS
    # =========================================================

    "Écrans & Moniteurs": [

        {
            "name": "Moniteur Samsung Odyssey G5 27 pouces 144Hz",
            "price": 999.000,
            "original_price": 1199.000,
            "stock": 14,
            "description": """
Écran gaming Samsung Odyssey G5 incurvé 27 pouces,
résolution QHD, fréquence 144Hz et temps de réponse 1ms.
            """,
        },

        {
            "name": "LG UltraWide 29 pouces IPS",
            "price": 849.000,
            "original_price": 999.000,
            "stock": 11,
            "description": """
Moniteur LG UltraWide 29 pouces Full HD IPS,
format 21:9 idéal pour le multitâche et la création graphique.
            """,
        },
    ],

    # =========================================================
    # AUDIO
    # =========================================================

    "Audio": [

        {
            "name": "Casque Sony WH-1000XM5",
            "price": 1299.000,
            "original_price": 1499.000,
            "stock": 16,
            "description": """
Casque Bluetooth Sony WH-1000XM5 avec réduction de bruit active,
autonomie jusqu’à 30 heures et qualité audio Hi-Res.
            """,
        },

        {
            "name": "Enceinte JBL Charge 5 Bluetooth",
            "price": 599.000,
            "original_price": 699.000,
            "stock": 22,
            "description": """
Enceinte portable JBL Charge 5 résistante à l’eau IP67,
son puissant JBL Pro Sound et autonomie de 20 heures.
            """,
        },
    ],

    # =========================================================
    # APPAREILS PHOTO
    # =========================================================

    "Appareils Photo": [

        {
            "name": "Canon EOS R50 Hybride 24MP",
            "price": 3299.000,
            "original_price": 3599.000,
            "stock": 7,
            "description": """
Appareil photo hybride Canon EOS R50 avec capteur APS-C 24.2MP,
vidéo 4K UHD et autofocus intelligent Dual Pixel.
            """,
        },

        {
            "name": "GoPro HERO 12 Black",
            "price": 1799.000,
            "original_price": 1999.000,
            "stock": 13,
            "description": """
Caméra sportive GoPro HERO 12 Black avec stabilisation HyperSmooth,
vidéo 5.3K et étanchéité jusqu’à 10 mètres.
            """,
        },
    ],

    # =========================================================
    # GAMING
    # =========================================================

    "Gaming": [

        {
            "name": "Sony PlayStation 5 Standard Edition",
            "price": 2499.000,
            "original_price": 2799.000,
            "stock": 9,
            "description": """
Console Sony PlayStation 5 avec SSD ultra rapide,
ray tracing, support 4K HDR et manette DualSense immersive.
            """,
        },

        {
            "name": "Nintendo Switch OLED",
            "price": 1399.000,
            "original_price": 1549.000,
            "stock": 17,
            "description": """
Console Nintendo Switch OLED avec écran 7 pouces OLED,
stockage interne 64Go et mode portable ou TV.
            """,
        },
    ],

    # =========================================================
    # TABLETTES
    # =========================================================

    "Tablettes": [

        {
            "name": "Samsung Galaxy Tab S9 256Go",
            "price": 2899.000,
            "original_price": 3199.000,
            "stock": 10,
            "description": """
Tablette Samsung Galaxy Tab S9 avec écran AMOLED 11 pouces 120Hz,
Snapdragon 8 Gen 2 et stylet S-Pen inclus.
            """,
        },

        {
            "name": "Apple iPad Air M2 11 pouces",
            "price": 3299.000,
            "original_price": 3599.000,
            "stock": 8,
            "description": """
iPad Air équipé de la puce Apple M2,
écran Liquid Retina 11 pouces et compatibilité Apple Pencil Pro.
            """,
        },
    ],

    # =========================================================
    # OBJETS CONNECTÉS
    # =========================================================

    "Objets Connectés": [

        {
            "name": "Apple Watch Series 9 GPS",
            "price": 1899.000,
            "original_price": 2099.000,
            "stock": 19,
            "description": """
Montre connectée Apple Watch Series 9 avec écran Retina Always-On,
suivi santé avancé et puce S9 ultra rapide.
            """,
        },

        {
            "name": "Xiaomi Smart Band 8",
            "price": 169.000,
            "original_price": 199.000,
            "stock": 45,
            "description": """
Bracelet connecté Xiaomi Smart Band 8 avec écran AMOLED,
suivi sportif, fréquence cardiaque et autonomie jusqu’à 16 jours.
            """,
        },
    ],

    # =========================================================
    # CUISINE CONNECTÉE
    # =========================================================

    "Cuisine Connectée": [

        {
            "name": "Machine à Café DeLonghi Magnifica S",
            "price": 1899.000,
            "original_price": 2199.000,
            "stock": 6,
            "description": """
Machine à café automatique DeLonghi Magnifica S
avec broyeur intégré et mousseur à lait cappuccino.
            """,
        },

        {
            "name": "Air Fryer Xiaomi Smart 6.5L",
            "price": 499.000,
            "original_price": 599.000,
            "stock": 20,
            "description": """
Friteuse sans huile Xiaomi Smart Air Fryer 6.5L
avec contrôle via application mobile et cuisson intelligente.
            """,
        },
    ],

    # =========================================================
    # SMART HOME
    # =========================================================

    "Smart Home": [

        {
            "name": "Google Nest Mini 2ème Génération",
            "price": 199.000,
            "original_price": 249.000,
            "stock": 31,
            "description": """
Assistant vocal Google Nest Mini compatible Google Assistant,
contrôle vocal maison connectée et streaming audio.
            """,
        },

        {
            "name": "Ampoule Connectée Philips Hue E27",
            "price": 99.000,
            "original_price": 129.000,
            "stock": 54,
            "description": """
Ampoule intelligente Philips Hue LED RGB,
pilotable via smartphone ou assistant vocal.
            """,
        },
    ],

    # =========================================================
    # PRÉPARATION CULINAIRE
    # =========================================================

    "Préparation culinaire": [

        {
            "name": "Robot Pâtissier Moulinex Masterchef Gourmet",
            "price": 799.000,
            "original_price": 949.000,
            "stock": 12,
            "description": """
Robot pâtissier Moulinex Masterchef avec bol inox 4.6L,
puissance 1100W et kit pâtisserie complet.
            """,
        },

        {
            "name": "Blender Nutribullet Pro 900W",
            "price": 349.000,
            "original_price": 399.000,
            "stock": 28,
            "description": """
Blender Nutribullet Pro 900W idéal pour smoothies,
mixage haute vitesse et lames en acier inoxydable.
            """,
        },
    ],

    # =========================================================
    # CLIMATISATION
    # =========================================================

    "Climatisation": [

        {
            "name": "Climatiseur LG Dual Inverter 12000 BTU",
            "price": 2299.000,
            "original_price": 2599.000,
            "stock": 9,
            "description": """
Climatiseur LG Dual Inverter 12000 BTU chaud/froid,
économie d’énergie et fonctionnement silencieux.
            """,
        },

        {
            "name": "Climatiseur Samsung WindFree 18000 BTU",
            "price": 3199.000,
            "original_price": 3499.000,
            "stock": 5,
            "description": """
Climatiseur Samsung WindFree avec technologie sans courant d’air,
mode intelligent et connectivité Wi-Fi.
            """,
        },
    ],

    # =========================================================
    # CUISSON
    # =========================================================

    "Cuisson": [

        {
            "name": "Four Encastrable Samsung 68L",
            "price": 1499.000,
            "original_price": 1699.000,
            "stock": 11,
            "description": """
Four encastrable Samsung multifonction 68 litres
avec chaleur tournante et nettoyage catalytique.
            """,
        },

        {
            "name": "Micro-ondes Sharp 25L Digital",
            "price": 399.000,
            "original_price": 479.000,
            "stock": 23,
            "description": """
Micro-ondes Sharp capacité 25 litres,
commandes digitales et programmes automatiques.
            """,
        },
    ],
}

# Villes tunisiennes (pour contextualiser les données)
TUNISIAN_CITIES = [
    "Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte",
    "Gabès", "Ariana", "Gafsa", "Monastir", "Ben Arous",
    "Nabeul", "Kasserine", "Médenine", "La Marsa", "Hammam-Lif",
]

REVIEW_COMMENTS = {
    5: [
        "Excellent produit, exactement ce que je cherchais !",
        "Très satisfait, livraison rapide et emballage soigné.",
        "Qualité supérieure, je recommande vivement.",
        "Rapport qualité-prix imbattable. Bravo SmartShop !",
        "Parfait, conforme à la description. Très content.",
    ],
    4: [
        "Bon produit dans l'ensemble, quelques petits bémols.",
        "Satisfait de mon achat, livraison dans les délais.",
        "Très bien, je referai des achats sur ce site.",
        "Bonne qualité, mais le packaging pourrait être amélioré.",
        "Article correct, correspond à mes attentes.",
    ],
    3: [
        "Produit moyen, pas exactement ce que j'attendais.",
        "Correct sans plus, le prix est un peu élevé.",
        "Fonctionnel mais sans plus. Peut mieux faire.",
        "Satisfait à moitié, certains défauts notables.",
    ],
    2: [
        "Déçu par la qualité, ne correspond pas à la description.",
        "Produit fragile, dommage pour le prix.",
        "Pas terrible, je ne recommande pas.",
    ],
    1: [
        "Très mauvaise expérience, produit défectueux.",
        "Ne fonctionne pas correctement. À éviter.",
        "Perte d'argent, très déçu du produit.",
    ],
}


PAYMENT_METHODS = ['COD', 'MOBILE', 'CARD']
PAYMENT_WEIGHTS = [0.5, 0.25, 0.25]   # COD dominant en Tunisie

