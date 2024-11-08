import { base64ToFile, IFilesUpload } from '../../gen/files';
import { bucket } from '../../firebase'; // Asegúrate de importar tu configuración de Firebase

class FileUploadService {
  async uploadFile(base64String: string, name:string): Promise<string> {

    let file = base64ToFile(base64String, name)

    if (!file) throw new Error('No file provided');

    const base64Data = base64String.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    return new Promise((resolve, reject) => {
      const blob = bucket.file(file.name);
      const stream = blob.createWriteStream({
        metadata: {
          contentType: file.type,
        },
      });

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('finish', async () => {
        try {
          // Hacer que el archivo sea público
          await blob.makePublic();
          // Generar la URL pública
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          resolve(publicUrl);
        } catch (err) {
          reject('Error al hacer público el archivo');
        }
      });

      stream.end(buffer);
    });
  }

  async uploadFiles(files: IFilesUpload[] | undefined): Promise<string[]> {
    if (!files) {
      return []; // Retorna un array vacío si files es undefined
    }
  
    const uploadPromises = files.map(({ base64, name }) => this.uploadFile(base64, name));
    return Promise.all(uploadPromises);
  }
  
}

export default new FileUploadService();
