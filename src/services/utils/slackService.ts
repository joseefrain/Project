import { WebClient } from '@slack/web-api';

interface ProductReorder {
  name: string;
  currentQuantity: number;
  reorderPoint: number;
}

type Product = {
  name: string;
  quantity: number;
};

const getUserId = async (username: string): Promise<string | null> => {

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const slackClient = new WebClient(slackToken);

  try {
    const result = await slackClient.users.list({});
    const user = result.members?.find((member) => member.real_name === username);

    return user ? user.id as string : null;
  } catch (error) {
    console.error('Error obteniendo el ID de usuario:', error);
    return null;
  }
};

export const sendChannelMessage = async (channel: string, message: string): Promise<void> => {
  try {

    const slackToken = process.env.SLACK_BOT_TOKEN;
    const slackClient = new WebClient(slackToken);
    
    
    await slackClient.chat.postMessage({
      text: message,
      channel,
    });
    console.log(`Mensaje enviado al canal ${channel} con éxito.`);
  } catch (error) {
    console.error('Error enviando mensaje al canal de Slack:', error);
  }
};

export const sendDirectMessage = async (username: string, message: string): Promise<void> => {
  try {
    
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const slackClient = new WebClient(slackToken);

    const users = await slackClient.users.list({});
    const user = users.members?.find((member) => member.name === username);

    if (!user || !user.id) {
      console.error('Usuario no encontrado o no tiene un ID válido.');
      return;
    }

    const im = await slackClient.conversations.open({ users: user.id });
    const channelId = im.channel?.id;

    if (channelId) {
      await slackClient.chat.postMessage({
        text: message,
        channel: channelId,
      });
      console.log(`Mensaje enviado a ${username} con éxito.`);
    }
  } catch (error) {
    console.error('Error enviando mensaje directo en Slack:', error);
  }
};

export const notifyManagerOfIncomingProducts = async (
  username: string,
  branchName: string,
  productList: Product[],
  orderId: string,
  originBranch: string,
  channel: string
) => {

  let userId = await getUserId(username);

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const slackClient = new WebClient(slackToken);

  const currentDate = new Date().toLocaleString();

  const productDetails = productList
    .map((product, index) => `• ${index + 1}. ${product.name} - Cantidad: ${product.quantity}`)
    .join('\n');

  const totalQuantity = productList.reduce((total, product) => total + product.quantity, 0);

  const message = {
    text: `:package: *Notificación de Envío de Productos*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Hola <@${userId}>, un nuevo pedido ha sido enviado a la sucursal de ${branchName}.*`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `:calendar: *Fecha del envío:* ${currentDate}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*ID de Pedido:* ${orderId}\n*Origen del Envío:* ${originBranch}`
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Detalles del Envío:*\n${productDetails}\n\n*Total de Productos:* ${productList.length}\n*Cantidad Total:* ${totalQuantity}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `:truck: _Este mensaje es una notificación automática._`
          }
        ]
      }
    ]
  };

  try {
    await slackClient.chat.postMessage({
      channel: (channel as string),
      ...message
    });
    console.log(`Notificación enviada a ${username} sobre el envío de productos a ${branchName}.`);
  } catch (error) {
    console.error('Error enviando notificación al encargado de la sucursal:', error);
  }
};

export const notifyReorderThreshold = async (
  username: string,
  branchName: string,
  lowStockProducts: ProductReorder[],
  channel: string
) => {

  let userId = await getUserId(username);

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const slackClient = new WebClient(slackToken);

  const productDetails = lowStockProducts.map((product) => {
    return `• *${product.name}*: Cantidad actual: ${product.currentQuantity}, Punto de reorden: ${product.reorderPoint}`;
  }).join("\n");

  const message = {
    text: `:warning: *Alerta de Inventario Bajo en ${branchName}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*¡Atención <@${userId}>!* Los siguientes productos en la sucursal *${branchName}* han alcanzado o superado su nivel de reorden.`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Productos con bajo inventario:*\n${productDetails}\n\n*Es necesario realizar una nueva orden para evitar rupturas de stock.*`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `:truck: _Este mensaje es una notificación automática de control de inventario._`
          }
        ]
      }
    ]
  };

  try {
    await slackClient.chat.postMessage({
      channel: channel,  // ID del usuario encargado de la sucursal
      ...message
    });
    console.log(`Notificación de reorden enviada a ${userId} para la sucursal ${branchName}.`);
  } catch (error) {
    console.error('Error enviando notificación de reorden:', error);
  }
};

