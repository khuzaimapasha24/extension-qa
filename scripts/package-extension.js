import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// CRC-32 Implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function calculateCRC32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function getDosTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function getAllFiles(dirPath, arrayOfFiles = [], rootDir = dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles, rootDir);
    } else {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      arrayOfFiles.push({ fullPath, relPath });
    }
  }

  return arrayOfFiles;
}

function createZipArchive(sourceDir, destZipPath) {
  const files = getAllFiles(sourceDir);
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  const now = new Date();
  const { dosTime, dosDate } = getDosTime(now);

  for (const { fullPath, relPath } of files) {
    // Exclude existing zip files from being zipped into itself
    if (relPath.endsWith('.zip')) continue;

    const uncompressedData = fs.readFileSync(fullPath);
    const uncompressedSize = uncompressedData.length;
    const crc = calculateCRC32(uncompressedData);

    // Deflate compression
    const compressedData = zlib.deflateRawSync(uncompressedData, { level: 9 });
    const compressedSize = compressedData.length;

    const nameBuffer = Buffer.from(relPath, 'utf8');
    const nameLength = nameBuffer.length;

    // 1. Local File Header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed
    localHeader.writeUInt16LE(0, 6);          // General flag
    localHeader.writeUInt16LE(8, 8);          // Compression method: Deflate (8)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameLength, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length

    localChunks.push(localHeader, nameBuffer, compressedData);

    // 2. Central Directory Header
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0, 8);           // General flag
    centralHeader.writeUInt16LE(8, 10);          // Compression: Deflate (8)
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameLength, 28);
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // File comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number start
    centralHeader.writeUInt16LE(0, 36);          // Internal attributes
    centralHeader.writeUInt32LE(0, 38);          // External attributes
    centralHeader.writeUInt32LE(offset, 42);     // Relative offset of local header

    centralChunks.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameLength + compressedSize;
  }

  const centralDirBuffer = Buffer.concat(centralChunks);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = offset;
  const fileCount = files.filter(f => !f.relPath.endsWith('.zip')).length;

  // 3. End of Central Directory Record (EOCD)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // Signature
  eocd.writeUInt16LE(0, 4);                // Disk number
  eocd.writeUInt16LE(0, 6);                // Start disk number
  eocd.writeUInt16LE(fileCount, 8);        // Total entries on disk
  eocd.writeUInt16LE(fileCount, 10);       // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);  // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);// Central dir offset
  eocd.writeUInt16LE(0, 20);               // Comment length

  const finalZipBuffer = Buffer.concat([...localChunks, centralDirBuffer, eocd]);
  fs.writeFileSync(destZipPath, finalZipBuffer);

  return { fileCount, sizeBytes: finalZipBuffer.length };
}

// Validation and Execution
const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const packageJsonPath = path.resolve(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version || '1.0.0';

console.log('----------------------------------------------------');
console.log(`📦 Packaging AI Website QA Agent v${version} for Chrome Web Store...`);
console.log('----------------------------------------------------');

if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Validate essential Manifest V3 files in dist/
const requiredFiles = [
  'manifest.json',
  'src/background/service-worker.js',
  'src/content/index.js',
  'src/sidepanel/index.html',
  'src/popup/index.html',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
];

const missing = [];
for (const rel of requiredFiles) {
  const full = path.join(distDir, rel);
  if (!fs.existsSync(full)) {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  console.error('❌ Error: Missing required distribution files in dist/:');
  missing.forEach((f) => console.error(`   - ${f}`));
  console.error('Run "npm run build" before packaging.');
  process.exit(1);
}

const destZip = path.join(distDir, `ai-website-qa-agent-v${version}.zip`);
const result = createZipArchive(distDir, destZip);

console.log(`✅ Package built successfully!`);
console.log(`   - Output Archive: ${destZip}`);
console.log(`   - Total Files Packed: ${result.fileCount}`);
console.log(`   - Archive Size: ${(result.sizeBytes / 1024).toFixed(2)} KB`);
console.log('----------------------------------------------------');
console.log('🚀 Ready to upload to the Chrome Web Store Developer Dashboard!');
