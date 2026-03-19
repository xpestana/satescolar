import jsPDF from "jspdf";

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let fontsLoaded = false;
let regularBase64 = "";
let boldBase64 = "";

async function ensureFontsLoaded() {
  if (fontsLoaded) return;
  [regularBase64, boldBase64] = await Promise.all([
    fetchFontAsBase64("/fonts/LiberationSans-Regular.ttf"),
    fetchFontAsBase64("/fonts/LiberationSans-Bold.ttf"),
  ]);
  fontsLoaded = true;
}

export async function addArialFont(doc: jsPDF) {
  await ensureFontsLoaded();
  doc.addFileToVFS("LiberationSans-Regular.ttf", regularBase64);
  doc.addFont("LiberationSans-Regular.ttf", "Arial", "normal");
  doc.addFileToVFS("LiberationSans-Bold.ttf", boldBase64);
  doc.addFont("LiberationSans-Bold.ttf", "Arial", "bold");
  doc.setFont("Arial", "normal");
}
