const typeModules = import.meta.glob("./types/*.jsx", { eager: true });

const PANELS = Object.fromEntries(
  Object.entries(typeModules).map(([path, module]) => {
    const file = path.slice(path.lastIndexOf("/") + 1, -4);
    return [file, module.default];
  }),
);

export function getSecondsTypePanel(typeId) {
  if (!typeId) return null;
  return PANELS[typeId] ?? null;
}
