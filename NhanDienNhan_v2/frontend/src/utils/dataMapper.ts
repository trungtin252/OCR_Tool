const formTypeMap: Record<string, string> = {
  bot: "Bột",
  nuoc: "Nước",
  vien: "Viên",
  khac: "Khác",
  // seed
  hat: "Hạt",
  cay: "Cây",
};

export function getFormTypeLabel(formType: string) {
  return formTypeMap[formType.toLocaleLowerCase()] || "Không xác định";
}

const netContentCategoryMap = {
  "Khối lượng tịnh": ["kg", "g", "mg"],
  "Thể tích thực": ["lít", "lit", "l", "ml"],
};

export function getNetContentTitle(unit: string) {
  const normalized = unit.trim().toLowerCase();

  return (
    Object.entries(netContentCategoryMap).find(([, units]) =>
      units.includes(normalized),
    )?.[0] || "Dung lượng"
  );
}

const unitMap: Record<string, string> = {
  gram: "g",
  kg: "Kg",
  lit: "Lít",
  ml: "ml",
};

export function getUnitLabel(unit: string) {
  return unitMap[unit.toLocaleLowerCase()] || unit;
}

// pesticide type mapping
const pesticideTypeMap: Record<string, string> = {
  hoa_hoc: "Hóa học",
  sinh_hoc: "Sinh học",
  vi_sinh: "Vi sinh",
  khac: "Khác",
};

export function getPesticideTypeLabel(type: string) {
  return pesticideTypeMap[type.toLocaleLowerCase()] || "Không xác định";
}

// ------------- Fertilizer type mapping -------------
const fertilizerTypeMap: Record<string, string> = {
  vo_co: "Vô cơ",
  huu_co: "Hữu cơ",
  vi_sinh: "Vi sinh",
  khac: "Khác",
};

export function getFertilizerTypeLabel(type: string) {
  return fertilizerTypeMap[type.toLocaleLowerCase()] || "Không xác định";
}
