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
      "base_extension": "Taban Genişletme (mm)",
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
      "shape": "ŞEKİL",
      "shape_cylinder": "Silindir",
      "shape_square": "Kare",
      "outer_size": "Dış Ölçü (mm)",
      "windows": "PENCERELER",
      "has_windows": "Pencere Ekle",
      "num_windows": "Pencere Sayısı",
      "window_width": "Pencere Genişliği (mm)",
      "window_height": "Pencere Yüksekliği (mm)",
      "window_arched": "Kemerli Pencere",
      "towers": "KULELER",
      "has_towers": "Kule Ekle",
      "tower_radius": "Kule Yarıçapı (mm)",
      "tower_height": "Kule Yüksekliği (mm)",
      "corner_radius": "Köşe Yuvarlatma (mm)",
      "brick_texture": "Tuğla Deseni",
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
      "outer_size": "Outer Size (mm)",
      "height": "Height (mm)",
      "wall_thickness": "Wall Thickness (mm)",
      "bottom_thickness": "Bottom Thickness (mm)",
      "base_extension": "Base Extension (mm)",
      "crenellations": "CRENELLATIONS",
      "num_crenellations": "Number of Crenellations",
      "crenellation_height": "Crenellation Height (mm)",
      "door": "DOOR",
      "has_door": "Add Door",
      "door_width": "Door Width (mm)",
      "door_height": "Door Height (mm)",
      "shape": "SHAPE",
      "shape_cylinder": "Cylinder",
      "shape_square": "Square",
      "windows": "WINDOWS",
      "has_windows": "Add Windows",
      "num_windows": "Number of Windows",
      "window_width": "Window Width (mm)",
      "window_height": "Window Height (mm)",
      "window_arched": "Arched Window",
      "towers": "TOWERS",
      "has_towers": "Add Towers",
      "tower_radius": "Tower Radius (mm)",
      "tower_height": "Tower Height (mm)",
      "corner_radius": "Corner Radius (mm)",
      "brick_texture": "Brick Texture",
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
