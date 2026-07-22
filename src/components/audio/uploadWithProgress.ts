/** PUTs a file to `url` and reports upload progress (0–1). Needs XHR — fetch has no upload progress event. */
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Uppladdningen misslyckades (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Nätverksfel under uppladdning"));
    xhr.send(file);
  });
}
