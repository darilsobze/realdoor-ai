// Fixture PDFs are imported as asset URLs for the live safety proofs.
declare module "*.pdf?url" {
  const url: string;
  export default url;
}
