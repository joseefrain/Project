function base64ToFile(base64: string, filename: string): File {
  // Eliminar el prefijo de la cadena Base64 si lo tiene
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/);
  const byteString = atob(arr[1]);

  // Crear un array de bytes
  const ab = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ab[i] = byteString.charCodeAt(i);
  }

  // Crear un objeto File
  return new File([ab], filename, { type: mime ? mime[1] : 'application/octet-stream' });
}

interface IFilesUpload {
  base64:string;
  name:string;
}

export { base64ToFile, IFilesUpload }