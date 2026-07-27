const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/uploads/gallery/66a60ff0917652064ed0c8c74/1784748091128-1689973356919439.png');

try {
  const buffer = fs.readFileSync(filePath);
  console.log('File size on disk:', buffer.length);
  console.log('First 50 bytes (hex):', buffer.slice(0, 50).toString('hex'));
  console.log('First 50 bytes (ascii):', buffer.slice(0, 50).toString('ascii'));
} catch (err) {
  console.error('Error reading file:', err.message);
}
