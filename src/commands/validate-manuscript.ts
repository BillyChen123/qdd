import { validateManuscriptPackage } from '../services/manuscript-package.js';

export async function validateManuscriptCommand(packagePath: string, options: { json?: boolean } = {}): Promise<void> {
  const report = await validateManuscriptPackage(packagePath);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Manuscript package: ${report.package_dir}`);
  console.log('Mechanical checks: passed');
  console.log(`PDF status: ${report.pdf_status}`);
  if (report.pdf_path) console.log(`PDF: ${report.pdf_path}`);
}
