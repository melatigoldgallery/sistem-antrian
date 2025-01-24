import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';
import { database } from './configFirebase.js';

document.addEventListener("DOMContentLoaded", () => {
    const queueRef = ref(database, 'queue');
    
    onValue(queueRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Calculate current number
            const currentFullNumber = data.currentNumber + (data.currentBlock * 10);
            
            // Update current queue display
            document.getElementById("queueNumber").textContent = 
                `${["A", "B", "C", "D"][data.currentLetter]}${String(currentFullNumber).padStart(2, '0')}`;
            
            // Calculate next number and letter
            let nextNumber = data.currentNumber + 1;
            let nextLetter = data.currentLetter;
            let nextBlock = data.currentBlock;

            if (nextNumber > 10) {
                nextNumber = 1;
                nextLetter = data.currentLetter + 1;
                if (nextLetter >= 4) {
                    nextLetter = 0;
                    nextBlock++;
                }
            }

            const nextFullNumber = nextNumber + (nextBlock * 10);
            
            // Update next queue display
            document.getElementById("nextQueueNumber").textContent = 
                `${["A", "B", "C", "D"][nextLetter]}${String(nextFullNumber).padStart(2, '0')}`;
            
            // Update delayed queue display
            document.getElementById("delayQueueNumber").textContent = 
                data.delayedQueue?.join(", ") || "-";
        }
    });
});