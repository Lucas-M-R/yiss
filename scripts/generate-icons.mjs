import sharp from 'sharp'
import { readFileSync } from 'fs'

const sizes = [192, 512]
const input = 'public/yisss.png'

for (const size of sizes) {
  await sharp(input)
    .resize(size, size, { fit: 'cover' })
    .toFile(`public/icons/icon-${size}x${size}.png`)
  console.log(`✓ Generated ${size}x${size}`)
}

// Maskable (padding pour Android adaptive icons)
await sharp(input)
  .resize(512, 512, { fit: 'contain', background: '#18181b' })
  .toFile('public/icons/icon-512x512-maskable.png')
console.log('✓ Generated 512x512 maskable')

// Favicon
await sharp(input)
  .resize(32, 32, { fit: 'cover' })
  .toFile('public/favicon.ico')
console.log('✓ Generated favicon.ico')
