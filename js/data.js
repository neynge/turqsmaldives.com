/* ============================================================
   Turqs Maldives — seed data
   NOTE: these are DEFAULTS only. js/store.js loads them once,
   then keeps the live catalogue in localStorage so the admin
   dashboard can create / edit / delete / re-price everything.
   ============================================================ */
const STORE = {
  name: "Turqs Maldives",
  currency: "$",
  instagram: "https://www.instagram.com/turqs_maldives/",   // <-- your IG handle
  shippingFlat: 15,
  freeShippingOver: 500,
  taxRate: 0.08,
  lowStockAt: 3
};

const DEFAULT_CATEGORIES = [
  { id:"rings",     name:"Rings",     desc:"Solitaires, bands & eternity",
    img:"https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800" },
  { id:"necklaces", name:"Necklaces", desc:"Pendants & chains",
    img:"https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800" },
  { id:"earrings",  name:"Earrings",  desc:"Studs, hoops & drops",
    img:"https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800" },
  { id:"bracelets", name:"Bracelets", desc:"Tennis, bangles & cuffs",
    img:"https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800" },
  { id:"watches",   name:"Watches",   desc:"Timeless craftsmanship",
    img:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800" },
  { id:"bridal",    name:"Bridal",    desc:"Engagement & wedding sets",
    img:"https://images.unsplash.com/photo-1591209627636-cb0a6b1c1a5f?w=800" }
];

const DEFAULT_PRODUCTS = [
  { id:1, name:"Solitaire Halo Ring", category:"rings", price:1290, old:1490, metal:"18K White Gold",
    stone:"0.75ct Diamond", weight:"3.2 g", sku:"AR-RG-001", stock:8, tag:"Bestseller", active:true,
    desc:"A brilliant-cut centre diamond framed by a micro-pave halo on a knife-edge band.",
    images:["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800",
            "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800"] },
  { id:2, name:"Eternity Band", category:"rings", price:940, old:null, metal:"Platinum 950",
    stone:"1.0ct Diamonds", weight:"4.1 g", sku:"AR-RG-002", stock:5, tag:null, active:true,
    desc:"Full-circle channel-set diamonds - a modern symbol of forever.",
    images:["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800"] },
  { id:3, name:"Pearl Drop Pendant", category:"necklaces", price:480, old:null, metal:"14K Yellow Gold",
    stone:"Akoya Pearl", weight:"2.6 g", sku:"AR-NL-011", stock:14, tag:"New", active:true,
    desc:"A lustrous Akoya pearl suspended from a delicate cable chain.",
    images:["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800"] },
  { id:4, name:"Emerald Cut Necklace", category:"necklaces", price:1680, old:1890, metal:"18K White Gold",
    stone:"Colombian Emerald", weight:"5.0 g", sku:"AR-NL-012", stock:3, tag:"Limited", active:true,
    desc:"A vivid emerald in a bezel setting, hand-finished in our atelier.",
    images:["https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800"] },
  { id:5, name:"Diamond Stud Earrings", category:"earrings", price:760, old:null, metal:"18K Rose Gold",
    stone:"0.50ct Diamonds", weight:"1.8 g", sku:"AR-ER-021", stock:20, tag:"Bestseller", active:true,
    desc:"Four-prong classic studs - the everyday essential.",
    images:["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800"] },
  { id:6, name:"Gold Hoop Earrings", category:"earrings", price:320, old:390, metal:"14K Yellow Gold",
    stone:"-", weight:"2.2 g", sku:"AR-ER-022", stock:26, tag:"Sale", active:true,
    desc:"Lightweight polished hoops with a secure hinged closure.",
    images:["https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800"] },
  { id:7, name:"Tennis Bracelet", category:"bracelets", price:2150, old:null, metal:"Platinum 950",
    stone:"2.0ct Diamonds", weight:"9.4 g", sku:"AR-BR-031", stock:4, tag:null, active:true,
    desc:"Fifty graduated diamonds in a flexible line setting with a double-lock clasp.",
    images:["https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800"] },
  { id:8, name:"Sapphire Bangle", category:"bracelets", price:890, old:null, metal:"18K White Gold",
    stone:"Ceylon Sapphire", weight:"11.0 g", sku:"AR-BR-032", stock:6, tag:"New", active:true,
    desc:"A hinged bangle accented with a cabochon Ceylon sapphire.",
    images:["https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800"] },
  { id:9, name:"Classic Automatic Watch", category:"watches", price:2450, old:2790, metal:"Stainless Steel",
    stone:"Sapphire Crystal", weight:"78 g", sku:"AR-WT-041", stock:7, tag:"Sale", active:true,
    desc:"Swiss automatic movement, 42-hour reserve, 50 m water resistance.",
    images:["https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800"] },
  { id:10, name:"Bridal Ring Set", category:"bridal", price:3200, old:null, metal:"18K White Gold",
    stone:"1.25ct Diamonds", weight:"7.8 g", sku:"AR-BD-051", stock:2, tag:"Limited", active:true,
    desc:"Matched engagement ring and wedding band, sold as a set.",
    images:["https://images.unsplash.com/photo-1591209627636-cb0a6b1c1a5f?w=800"] },
  { id:11, name:"Rose Gold Chain", category:"necklaces", price:410, old:null, metal:"14K Rose Gold",
    stone:"-", weight:"3.9 g", sku:"AR-NL-013", stock:18, tag:null, active:true,
    desc:"A 45 cm rolo chain that layers beautifully with pendants.",
    images:["https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800"] },
  { id:12, name:"Signet Ring", category:"rings", price:560, old:null, metal:"18K Yellow Gold",
    stone:"Onyx", weight:"6.5 g", sku:"AR-RG-003", stock:11, tag:null, active:true,
    desc:"A heritage-inspired signet with a hand-set onyx face, engravable.",
    images:["https://images.unsplash.com/photo-1610694955371-d4a3e0f4c94c?w=800"] }
];

<script src="https://snapwidget.com/js/snapwidget.js"></script>

const PRODUCT_TAGS = ["", "New", "Sale", "Bestseller", "Limited"];


