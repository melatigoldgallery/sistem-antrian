import { AUDIO_PATHS } from "./audioConfig.js";

export async function playWaitMessageSequence(language = 'id') {
  const openingChime = new Audio(AUDIO_PATHS.informasi);
  const closingChime = new Audio(AUDIO_PATHS.informasiEnd);
  
  // Wait message texts
  const waitTexts = {
    id: "Kepada Pelanggan Melati yang belum dilayani, kami mohon kesabarannya untuk menunggu giliran pelayanan. Terima kasih atas perhatiannya",
    en: "To Melati customers who have not been served, we ask for patience to wait for their turn. Thank you for your attention"
  };

  // Play opening chime
  await new Promise((resolve) => {
    openingChime.addEventListener("ended", resolve);
    openingChime.play();
  });

  // Play text-to-speech message
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(waitTexts[language]);
    utterance.lang = language === 'id' ? "id-ID" : "en-US";
    utterance.rate = 0.8;
    utterance.pitch = 1.5;
    utterance.onend = resolve;
    
    speechSynthesis.speak(utterance);
  });
  // Play closing chime
  await new Promise((resolve) => {
    closingChime.addEventListener("ended", resolve);
    closingChime.play();
  });
}

export async function playTakeQueueMessage(language = 'id') {
  const openingChime = new Audio(AUDIO_PATHS.informasi);
  const closingChime = new Audio(AUDIO_PATHS.informasiEnd);
  
  // Reminder message texts
  const reminderTexts = {
    id: "Kepada pelanggan yang belum mendapat nomor antrian, harap meminta nomor antrian terlebih dahulu kepada staff Melati. Terima kasih atas perhatiannya",
    en: "To customers who haven't received a queue number, please request a queue number first from Melati staff. Thank you for your attention"
  };

  // Play opening chime
  await new Promise((resolve) => {
    openingChime.addEventListener("ended", resolve);
    openingChime.play();
  });

  // Play voice message
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(reminderTexts[language]);
    utterance.lang = language === 'id' ? "id-ID" : "en-US";
    utterance.rate = 0.8;
    utterance.pitch = 1.5;
    utterance.onend = resolve;

    speechSynthesis.speak(utterance);
  });
   // Play closing chime
   await new Promise((resolve) => {
    closingChime.addEventListener("ended", resolve);
    closingChime.play();
  });
}

export function announceQueueNumber(queueNumber, language = 'id') {
  const letter = queueNumber.charAt(0);
  const numbers = queueNumber.substring(1);

  const texts = {
    id: `Nomor antrian ${letter}, ${numbers.split("").join(" ")}`,
    en: `Queue number ${letter}, ${numbers.split("").join(" ")}`
  };

  const utterance = new SpeechSynthesisUtterance(texts[language]);

  // Get available voices
  const voices = window.speechSynthesis.getVoices();

  // Set voice preferences based on language
  utterance.lang = language === 'id' ? "id-ID" : "en-US";
  utterance.rate = 0.8;
  utterance.pitch = 1.5;

  speechSynthesis.speak(utterance);
}


export async function playQueueAnnouncement(queueNumber, language = 'id') {
  const introRingtone = new Audio(AUDIO_PATHS.antrian);
  const closingChime = new Audio(AUDIO_PATHS.informasiEnd);

  const playRingtone = () => {
    return new Promise((resolve) => {
      introRingtone.addEventListener("ended", resolve);
      introRingtone.play();
    });
  };

  // Play sequence: ringtone first, then queue announcement
  await playRingtone();
  await announceQueueNumber(queueNumber, language);
  await announceQueueNumber(queueNumber, language);
}

export async function announceVehicleMessage(carType, plateNumber, language = 'id') {
  const openingChime = new Audio(AUDIO_PATHS.informasi);
  const closingChime = new Audio(AUDIO_PATHS.informasiEnd);

  // Vehicle message texts
  const messages = {
    id: `Mohon kepada pemilik ${carType} dengan nomor polisi, ${plateNumber}, untuk memindahkan kendaraan karena ada kendaraan yang akan keluar. Terima kasih atas perhatiannya`,
    en: `To the owner of ${carType} with license plate ${plateNumber}, please move your vehicle as there is a vehicle in front that needs to exit. Thank you for your attention`
  };

  // Play opening chime
  await new Promise((resolve) => {
    openingChime.addEventListener("ended", resolve);
    openingChime.play();
  });

  // Announce message with proper Promise handling
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(messages[language]);
    utterance.lang = language === 'id' ? 'id-ID' : 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1.5;
    utterance.onend = resolve;
    window.speechSynthesis.speak(utterance);
  });
  
  // Play closing chime
  await new Promise((resolve) => {
    closingChime.addEventListener("ended", resolve);
    closingChime.play();
  });
}
