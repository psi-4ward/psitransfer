export default async function() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'lang.json');
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText))
        }
        catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Language load error: ${ xhr.status } ${ xhr.statusText }`))
      }
    };
    xhr.send();
  });
}
