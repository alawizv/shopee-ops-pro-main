import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

// Generate barcode as data URL
export const generateBarcodeDataURL = async (code, type) => {
  try {
    if (type === 'qrcode') {
      return await QRCode.toDataURL(code, { 
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H'
      });
    } else {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 10,
        fontSize: 14,
        background: '#ffffff',
        lineColor: '#000000'
      });
      return canvas.toDataURL('image/png');
    }
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error(`Gagal generate barcode: ${error.message}`);
  }
};

// Generate high-res barcode for JPG
export const generateBarcodeJPG = async (item, barcodeType, settings) => {
  try {
    // Generate barcode/QR first
    const barcodeDataURL = await generateBarcodeDataURL(item.code, barcodeType);
    
    // Create canvas for final image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 400;
    
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Load and draw barcode image
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Draw barcode centered
          const isQR = barcodeType === 'qrcode';
          const barcodeWidth = isQR ? 250 : 600;
          const barcodeHeight = isQR ? 250 : 200;
          const x = (canvas.width - barcodeWidth) / 2;
          const y = isQR ? 30 : 40;
          
          ctx.drawImage(img, x, y, barcodeWidth, barcodeHeight);
          
          // Draw text
          let textY = y + barcodeHeight + 30;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          
          if (settings.showCode) {
            ctx.font = `bold ${settings.fontSize * 2}px Arial`;
            ctx.fillText(item.code, canvas.width / 2, textY);
            textY += 30;
          }
          
          if (settings.showLabel && item.label) {
            ctx.font = `${(settings.fontSize - 1) * 2}px Arial`;
            const maxWidth = canvas.width - 40;
            ctx.fillText(item.label, canvas.width / 2, textY, maxWidth);
          }
          
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (drawError) {
          reject(new Error(`Gagal menggambar barcode: ${drawError.message}`));
        }
      };
      
      img.onerror = (err) => {
        console.error('Image load error:', err);
        reject(new Error('Gagal memuat gambar barcode'));
      };
      
      img.crossOrigin = 'anonymous';
      img.src = barcodeDataURL;
    });
  } catch (error) {
    console.error('Generate JPG error:', error);
    throw new Error(`Gagal generate JPG: ${error.message}`);
  }
};