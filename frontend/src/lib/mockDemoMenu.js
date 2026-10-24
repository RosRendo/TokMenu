export const MOCK_DEMO_MENU = {
  restaurant: {
    id: "demo-restaurant",
    name: "Tok Demo Kitchen",
    name_km: "ផ្ទះបាយគំរូ តុក",
    slug: "demo",
    description: "Authentic Khmer street food and modern café drinks in Phnom Penh.",
    description_km: "អាហារតាមចិញ្ចើមផ្លូវបែបខ្មែរពិតប្រាកដ និងភេសជ្ជៈកាហ្វេទំនើបនៅភ្នំពេញ។",
    phone: "+855 12 345 678",
    address: "Street 240, Daun Penh, Phnom Penh",
    logo_url: null,
    cover_url: "/demo/amok.jpg",
    settings: {
      currency: "USD",
      service_charge_bps: 0,
      tax_bps: 0,
      default_language: "en",
      temporarily_closed: false,
      opening_hours: []
    }
  },
  settings: {
    currency: "USD",
    service_charge_bps: 0,
    tax_bps: 0,
    default_language: "en",
    temporarily_closed: false,
    opening_hours: []
  },
  categories: [
    { id: "cat-specials", name: "Specials", name_km: "មុខម្ហូបពិសេស", sort_order: 1 },
    { id: "cat-food", name: "Food", name_km: "ម្ហូប", sort_order: 2 },
    { id: "cat-drinks", name: "Drinks", name_km: "ភេសជ្ជៈ", sort_order: 3 },
    { id: "cat-desserts", name: "Desserts", name_km: "បង្អែម", sort_order: 4 }
  ],
  items: [
    {
      id: "item-amok",
      category_id: "cat-specials",
      name: "Fish Amok",
      name_km: "អាម៉ុកត្រី",
      price: 650,
      image_url: "/demo/amok.jpg",
      featured: true,
      available: true,
      description: "Steamed fish curry with kroeung, coconut milk and noni leaves, served in a banana-leaf cup with rice.",
      description_km: "ត្រីចំហុយជាមួយគ្រឿង ខ្ទិះដូង និងស្លឹកញ័រ បម្រើក្នុងស្លឹកចេកជាមួយបាយ។",
      option_groups: []
    },
    {
      id: "item-loklak",
      category_id: "cat-specials",
      name: "Beef Lok Lak",
      name_km: "ឡុកឡាក់សាច់គោ",
      price: 600,
      image_url: "/demo/loklak.jpg",
      featured: true,
      available: true,
      description: "Stir-fried marinated beef with tomato, onion and lettuce, with a Kampot pepper and lime dip.",
      description_km: "សាច់គោឆាជាមួយប៉េងប៉ោះ ខ្ទឹមបារាំង និងសាឡាត់ ជាមួយទឹកម្រេចកំពត និងក្រូចឆ្មា។",
      option_groups: [
        {
          id: "og-addons",
          name: "Add-ons",
          name_km: "បន្ថែម",
          min_select: 0,
          max_select: 2,
          options: [
            { id: "opt-egg", name: "Fried egg", name_km: "ពងមាន់ចៀន", price_delta: 50, available: true },
            { id: "opt-rice", name: "Extra rice", name_km: "បាយបន្ថែម", price_delta: 50, available: true }
          ]
        }
      ]
    },
    {
      id: "item-kuyteav",
      category_id: "cat-food",
      name: "Kuy Teav Phnom Penh",
      name_km: "គុយទាវភ្នំពេញ",
      price: 350,
      image_url: "/demo/kuyteav.jpg",
      featured: false,
      available: true,
      description: "Rice noodle soup with clear pork broth, minced pork, shrimp and fresh herbs.",
      description_km: "គុយទាវទឹកស៊ុបឆ្អឹងជ្រូក សាច់ជ្រូកចិញ្ច្រាំ បង្គា និងបន្លែស្រស់។",
      option_groups: [
        {
          id: "og-size-kuyteav",
          name: "Size",
          name_km: "ទំហំ",
          min_select: 1,
          max_select: 1,
          options: [
            { id: "opt-reg", name: "Regular", name_km: "ធម្មតា", price_delta: 0, available: true },
            { id: "opt-large", name: "Large", name_km: "ធំ", price_delta: 100, available: true }
          ]
        }
      ]
    },
    {
      id: "item-baisach",
      category_id: "cat-food",
      name: "Bai Sach Chrouk",
      name_km: "បាយសាច់ជ្រូក",
      price: 250,
      image_url: "/demo/baisach.jpg",
      featured: false,
      available: true,
      description: "Grilled coconut-marinated pork over rice with pickled vegetables.",
      description_km: "សាច់ជ្រូកអាំងប្រឡាក់ខ្ទិះដូងលើបាយ ជាមួយជ្រក់។",
      option_groups: []
    },
    {
      id: "item-numbanhchok",
      category_id: "cat-food",
      name: "Num Banh Chok",
      name_km: "នំបញ្ចុក",
      price: 250,
      image_url: "/demo/numbanhchok.jpg",
      featured: false,
      available: true,
      description: "Fresh rice noodles with green fish curry gravy and raw vegetables.",
      description_km: "នំបញ្ចុកជាមួយសម្លប្រហើរត្រី និងបន្លែស្រស់។",
      option_groups: []
    },
    {
      id: "item-curry",
      category_id: "cat-food",
      name: "Khmer Chicken Curry",
      name_km: "ការីសាច់មាន់",
      price: 450,
      image_url: "/demo/curry.jpg",
      featured: false,
      available: true,
      description: "Mild red curry with chicken, sweet potato and lemongrass.",
      description_km: "ការីក្រហមមិនសូវហឹរ ជាមួយសាច់មាន់ ដំឡូងជ្វា និងស្លឹកគ្រៃ។",
      option_groups: []
    },
    {
      id: "item-coffee",
      category_id: "cat-drinks",
      name: "Iced Coffee with Milk",
      name_km: "កាហ្វេទឹកដោះគោទឹកកក",
      price: 150,
      image_url: "/demo/icedcoffee.jpg",
      featured: true,
      available: true,
      description: "Strong Cambodian coffee with sweetened condensed milk over ice.",
      description_km: "កាហ្វេខ្លាំងជាមួយទឹកដោះគោខាប់ និងទឹកកក។",
      option_groups: []
    },
    {
      id: "item-coconut",
      category_id: "cat-drinks",
      name: "Fresh Coconut",
      name_km: "ទឹកដូង",
      price: 150,
      image_url: "/demo/coconut.jpg",
      featured: false,
      available: true,
      description: "Whole young coconut, chilled.",
      description_km: "ដូងខ្ចីទាំងផ្លែ ត្រជាក់។",
      option_groups: []
    },
    {
      id: "item-lemontea",
      category_id: "cat-drinks",
      name: "Iced Lemon Tea",
      name_km: "តែក្រូចឆ្មាទឹកកក",
      price: 125,
      image_url: "/demo/lemontea.jpg",
      featured: false,
      available: true,
      description: "Black tea with fresh lime and a little sugar.",
      description_km: "តែខ្មៅជាមួយក្រូចឆ្មាស្រស់ និងស្ករបន្តិច។",
      option_groups: []
    },
    {
      id: "item-mango",
      category_id: "cat-desserts",
      name: "Mango Sticky Rice",
      name_km: "បាយដំណើបស្វាយ",
      price: 250,
      image_url: "/demo/mango.jpg",
      featured: true,
      available: true,
      description: "Ripe mango with sweet coconut sticky rice.",
      description_km: "ស្វាយទុំជាមួយបាយដំណើបខ្ទិះដូង។",
      option_groups: []
    }
  ]
};
