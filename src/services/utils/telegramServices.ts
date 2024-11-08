import axiosInstance from '../../utils/axiosInstance';

type Product = {
  name: string;
  quantity: number;
};

interface ProductReorder {
  name: string;
  currentQuantity: number;
  reorderPoint: number;
}

export const notifyTelegramManagerOfIncomingProducts = async (
  username: string,
  branchName: string,
  productList: Product[],
  orderId: string,
  originBranch: string,
  senderName: string,
  chatId: string
) => {
  const currentDate = new Date().toLocaleString();

  // Detalles del producto con emojis
  const productDetails = productList
    .map(
      (product, index) => `🔹 *${product.name}* - Cantidad: ${product.quantity}`
    )
    .join('\n');

  const totalQuantity = productList.reduce(
    (total, product) => total + product.quantity,
    0
  );

  // Mensaje creativo y detallado
  const message = `
📦 *¡Notificación de Envío de Productos!*
-----------------------------------
✨ *Encargado:* ${username}
📍 *Sucursal Destino:* ${branchName}
🕒 *Fecha del Envío:* ${currentDate}
-----------------------------------

🚚 *Estado del Pedido:* En Camino
👤 *Enviado por:* ${senderName}
📦 *ID del Pedido:* #${orderId}
🏭 *Sucursal Origen:* ${originBranch}

-----------------------------------
📋 *Detalles del Envío:*
${productDetails}

🔢 *Total de Productos:* ${productList.length}
📦 *Cantidad Total:* ${totalQuantity}

-----------------------------------
💡 *Acción Recomendada:* Asegúrate de revisar el inventario y confirmar la recepción en cuanto llegue el pedido.

🚀 _Este mensaje es una notificación automática, diseñada para mantener tu inventario siempre bajo control._
  `;

  try {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    await axiosInstance.post(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown', // Usamos Markdown para formato enriquecido
      }
    );
    console.log(
      `Notificación enviada a ${username} sobre el envío de productos a ${branchName}.`
    );
  } catch (error) {
    console.error(
      'Error enviando notificación al encargado de la sucursal en Telegram:',
      error
    );
  }
};

export const notifyTelergramReorderThreshold = async (
  username: string,
  branchName: string,
  lowStockProducts: ProductReorder[],
  chatId: string
) => {
  const productDetails = lowStockProducts
    .map((product) => {
      return `🔸 *${product.name}*: Cantidad actual: ${product.currentQuantity}, Punto de reorden: ${product.reorderPoint}`;
    })
    .join('\n');

  const message = `
⚠️ *Alerta de Inventario Bajo en ${branchName}* ⚠️
-----------------------------------
👤 *Encargado:* ${username}

📦 Los siguientes productos en *${branchName}* han alcanzado su nivel de reorden:

${productDetails}

🔄 _Es necesario realizar una nueva orden para evitar rupturas de stock._

-----------------------------------
🚚 _Este mensaje es una notificación automática de control de inventario._
  `;

  try {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    await axiosInstance.post(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown', // Permite el uso de Markdown para negritas, cursivas, y emojis
      }
    );
    console.log(
      `Notificación de reorden enviada a ${username} para la sucursal ${branchName}.`
    );
  } catch (error) {
    console.error('Error enviando notificación de reorden en Telegram:', error);
  }
};
