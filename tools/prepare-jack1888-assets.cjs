const { copyFileSync, mkdirSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const sharp = require('C:/Users/handal2k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const sceneSource = resolve(process.argv[2] || 'D:/Deepseek/地点图');
const assetRoot = resolve(__dirname, '../assets/jack-1888');
const avatarDir = join(assetRoot, 'avatar');
const bannerDir = join(assetRoot, 'banners');
const locationDir = join(assetRoot, 'locations');
for (const dir of [avatarDir, bannerDir, locationDir]) mkdirSync(dir, { recursive: true });

const transcodes = [
  [join(avatarDir, 'jack-dialogue.png'), join(avatarDir, 'jack-dialogue.webp')],
  [join(bannerDir, 'banner-02.png'), join(bannerDir, 'banner-02.webp')],
  [join(bannerDir, 'banner-04.png'), join(bannerDir, 'banner-04.webp')],
  [join(locationDir, 'default-whitechapel.png'), join(locationDir, 'default-whitechapel.webp')],
  [join(sceneSource, "Dutfield's Yard.png"), join(locationDir, 'dutfields-yard.webp')],
];

const copies = [
  [join(sceneSource, 'Whitechapel 警局外.webp'), join(locationDir, 'whitechapel-station.webp')],
  [join(sceneSource, "Buck's Row.webp"), join(locationDir, 'bucks-row.webp')],
  [join(sceneSource, '29 Hanbury Street 后院.webp'), join(locationDir, 'hanbury-street.webp')],
  [join(sceneSource, 'Mitre Square.webp'), join(locationDir, 'mitre-square.webp')],
  [join(sceneSource, 'Goulston Street.webp'), join(locationDir, 'goulston-street.webp')],
  [join(sceneSource, "Miller's Court or Dorset Street.webp"), join(locationDir, 'millers-court.webp')],
];

async function main() {
  for (const [source, target] of transcodes) {
    await sharp(source).webp({ quality: 82, effort: 5 }).toFile(target);
  }
  for (const [source, target] of copies) copyFileSync(source, target);

  const outputs = [...transcodes, ...copies].map(([, target]) => ({
    file: target.replace(`${assetRoot}\\`, '').replaceAll('\\', '/'),
    bytes: statSync(target).size,
  }));
  console.table(outputs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
