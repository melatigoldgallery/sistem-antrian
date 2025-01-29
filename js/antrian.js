import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';
import { database } from './configFirebase.js';

export class QueueManager {
    constructor() {
        this.letters = ["A", "B", "C", "D"];
        this.initializeFromFirebase();
        this.customerRef = ref(database, 'customerCount');
        this.initializeCustomerCount();
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
    async initializeCustomerCount() {
        const snapshot = await get(this.customerRef);
        if (!snapshot.exists()) {
            await set(this.customerRef, 0);
        }
    }

    async incrementCustomer() {
        const snapshot = await get(this.customerRef);
        const currentCount = snapshot.val() || 0;
        await set(this.customerRef, currentCount + 1);
    }

    async decrementCustomer() {
        const snapshot = await get(this.customerRef);
        const currentCount = snapshot.val() || 0;
        if (currentCount > 0) {
            await set(this.customerRef, currentCount - 1);
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
        if (this.currentNumber > 10) {
            this.currentNumber = 1;
            this.currentLetter++;

            if (this.currentLetter >= this.letters.length) {
                this.currentLetter = 0;
                this.currentBlock++;

                if (this.currentBlock >= 5) {
                    this.currentBlock = 0;
                }
            }
        }
        this.saveState();
        return this.getCurrentQueue();
    }

    getNextQueue() {
        const nextState = {
            letter: this.currentLetter,
            number: this.currentNumber + 1,
            block: this.currentBlock
        };

        if (nextState.number > 10) {
            nextState.number = 1;
            nextState.letter++;

            if (nextState.letter >= this.letters.length) {
                nextState.letter = 0;
                nextState.block++;

                if (nextState.block >= 5) {
                    nextState.block = 0;
                }
            }
        }

        return `${this.letters[nextState.letter]}${this.formatNumber(nextState.number + nextState.block * 10)}`;
    }

    setCustomQueue(letter, number) {
        const letterIndex = this.letters.indexOf(letter);
        if (letterIndex === -1 || number < 1 || number > 50) {
            return false;
        }

        this.currentLetter = letterIndex;
        this.currentBlock = Math.floor((number - 1) / 10);
        this.currentNumber = ((number - 1) % 10) + 1;

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