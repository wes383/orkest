const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'legal', 'OPEN_SOURCE_LICENSES.md');

function generateLicenses() {
  let data;
  try {
    const output = execSync('npx license-checker --json', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    data = JSON.parse(output);
  } catch (error) {
    console.error('Failed to run license-checker:', error.stderr || error.message);
    process.exit(1);
  }

  const packages = Object.entries(data).map(([name, info]) => ({
    fullName: name,
    name: name.split('@').slice(0, -1).join('@'),
    version: name.split('@').pop(),
    license: info.licenses || 'Unknown',
    repository: info.repository || ''
  }));

  const byLicense = {};
  packages.forEach(p => {
    const license = p.license;
    if (!byLicense[license]) byLicense[license] = [];
    byLicense[license].push(p);
  });

  let md = 'This document lists the open-source software packages used by Orkest and their respective licenses.\n\n';
  md += 'Orkest is built on top of many excellent open-source projects. We are grateful to the maintainers and contributors of these projects.\n\n';
  md += '**Last Updated:** ' + new Date().toISOString().split('T')[0] + '\n\n';
  md += '## License Summary\n\n';
  md += '| License | Count |\n';
  md += '|---------|-------|\n';

  const sortedLicenses = Object.entries(byLicense).sort((a, b) => b[1].length - a[1].length);
  sortedLicenses.forEach(([license, pkgs]) => {
    md += `| ${license} | ${pkgs.length} |\n`;
  });
  md += '\n';

  sortedLicenses.forEach(([license, pkgs]) => {
    md += `## ${license}\n\n`;
    md += '| Package | Version | Repository |\n';
    md += '|---------|---------|------------|\n';
    pkgs.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
      const repo = p.repository
        ? `[${p.repository.replace('https://github.com/', '')}](${p.repository})`
        : '-';
      md += `| ${p.name} | ${p.version} | ${repo} |\n`;
    });
    md += '\n';
  });

  fs.writeFileSync(OUTPUT_FILE, md);
  console.log(`Generated ${OUTPUT_FILE}`);
  console.log(`Total packages: ${packages.length}`);
  console.log(`License types: ${sortedLicenses.length}`);

  // Automatically trigger the legal content compiler to update the static TS file
  try {
    require('./generate-legal-content');
    require('./generate-static-html');
  } catch (error) {
    console.error('Failed to update static legal content:', error.message);
  }
}

generateLicenses();
