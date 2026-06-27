import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  TR: {
    translation: {
      "title": "KALE KALEMLİK ÜRETİCİ",
      "settings_title": "Kale Kalemlik Ayarları",
      "export_ready": "DIŞA AKTARIMA HAZIR",
      "orbit_mode": "Yörünge Modu",
      "developer": "Geliştirici",
      "export_btn": "STL İNDİR",
      "dimensions": "BOYUTLAR",
      "outer_diameter": "Dış Çap (mm)",
      "height": "Yükseklik (mm)",
      "wall_thickness": "Duvar Kalınlığı (mm)",
      "bottom_thickness": "Taban Kalınlığı (mm)",
      "crenellations": "MAZGALLAR",
      "num_crenellations": "Diş Sayısı",
      "crenellation_height": "Diş Yüksekliği (mm)",
      "door": "KAPI",
      "has_door": "Kapı Ekle",
      "door_width": "Kapı Genişliği (mm)",
      "door_height": "Kapı Yüksekliği (mm)",
      "color": "RENK",
      "material_color": "Malzeme Rengi",
      "door_color": "Kapı Rengi",
      "language": "Dil",
    }
  },
  EN: {
    translation: {
      "title": "CASTLE PENCIL CASE MAKER",
      "settings_title": "Castle Pencil Case Settings",
      "export_ready": "READY FOR EXPORT",
      "orbit_mode": "Orbit Mode",
      "developer": "Developer",
      "export_btn": "DOWNLOAD STL",
      "dimensions": "DIMENSIONS",
      "outer_diameter": "Outer Diameter (mm)",
      "height": "Height (mm)",
      "wall_thickness": "Wall Thickness (mm)",
      "bottom_thickness": "Bottom Thickness (mm)",
      "crenellations": "CRENELLATIONS",
      "num_crenellations": "Number of Crenellations",
      "crenellation_height": "Crenellation Height (mm)",
      "door": "DOOR",
      "has_door": "Add Door",
      "door_width": "Door Width (mm)",
      "door_height": "Door Height (mm)",
      "color": "COLOR",
      "material_color": "Material Color",
      "door_color": "Door Color",
      "language": "Language",
    }
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "TR", 
    fallbackLng: "EN",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
