// The datasets are large JSON files loaded lazily via dynamic import. We keep
// `resolveJsonModule` off so tsc never parses the multi-MB files; this wildcard
// gives the imports an `any` default, and the loaders in index.ts cast to the
// precise types. The bundler (tsdown/rolldown) resolves the real JSON.
declare module "*.json" {
  const value: any;
  export default value;
}
