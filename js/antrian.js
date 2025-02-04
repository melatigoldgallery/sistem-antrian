import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';
import { database } from './configFirebase.js';

export class QueueManager {
    constructor() {
        this.letters = ["A", "B", "C", "D"];
        this.initializeFromFirebase();
    }

    async initializeFromFirebase() {
        const queueRef = ref(database, 'queue');
        const snapshot = await get(queueRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            this.currentLetter = data.currentLetter;
            this.currentNumber = data.currentNumber;
            this.currentBlock = data.currentBlock;
            this.delayedQueue = data.delayedQueue || [];
        } else {
            this.currentLetter = 0;
            this.currentNumber = 1;
            this.currentBlock = 0;
            this.delayedQueue = [];
            this.saveState();
        }
    }

    formatNumber(num) {
        return num.toString().padStart(2, "0");
    }

    getCurrentQueue() {
        return `${this.letters[this.currentLetter]}${this.formatNumber(this.currentNumber + this.currentBlock * 10)}`;
    }

    saveState() {
        const queueRef = ref(database, 'queue');
        set(queueRef, {
            currentLetter: this.currentLetter,
            currentNumber: this.currentNumber,
            currentBlock: this.currentBlock,
            delayedQueue: this.delayedQueue
        });
    }

    addToDelayedQueue(queueNumber) {
        if (!this.delayedQueue.includes(queueNumber)) {
            this.delayedQueue.push(queueNumber);
            this.saveState();
        }
    }

    removeFromDelayedQueue(queueNumber) {
        const index = this.delayedQueue.indexOf(queueNumber);
        if (index > -1) {
            this.delayedQueue.splice(index, 1);
            this.saveState();
        }
    }

    getDelayedQueue() {
        return this.delayedQueue;
    }

    next() {
        this.currentNumber++;
        if (this.currentNumber > 50) {
            this.currentNumber = 1;
            this.currentLetter++;

            if (this.currentLetter >= this.letters.length) {
                this.currentLetter = 0;
            }
        }
        this.saveState();
        return this.getCurrentQueue();
    }

    getNextQueue() {
        let nextLetter = this.currentLetter;
        let nextNumber = this.currentNumber + 1;

        if (nextNumber > 50) {
            nextNumber = 1;
            nextLetter++;

            if (nextLetter >= this.letters.length) {
                nextLetter = 0;
            }
        }

        return `${this.letters[nextLetter]}${this.formatNumber(nextNumber)}`;
    }

    setCustomQueue(letter, number) {
        const letterIndex = this.letters.indexOf(letter);
        if (letterIndex === -1 || number < 1 || number > 50) {
            return false;
        }

        this.currentLetter = letterIndex;
        this.currentNumber = number;

        this.saveState();
        return this.getCurrentQueue();
    }

    reset() {
        this.currentLetter = 0;
        this.currentNumber = 1;
        this.currentBlock = 0;
        this.delayedQueue = [];
        this.saveState();
        return this.getCurrentQueue();
    }
}