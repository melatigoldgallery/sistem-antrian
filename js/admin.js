import { db } from './configFirebase.js';
import { ref, set, get, onValue } from 'firebase/database';

export class QueueManager {
    constructor() {
        this.letters = ["A", "B", "C", "D"];
        this.initializeFirebase();
        
        // Initialize local state
        this.currentLetter = 0;
        this.currentNumber = 1;
        this.currentBlock = 0;
        this.delayedQueue = [];
    }

    async initializeFirebase() {
        const queueRef = ref(db, 'queueState');
        
        // Listen for real-time updates
        onValue(queueRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.currentLetter = data.letter;
                this.currentNumber = data.number;
                this.currentBlock = data.block;
                this.delayedQueue = data.delayedQueue || [];
                this.notifyListeners();
            }
        });
    }

    async saveState() {
        const state = {
            letter: this.currentLetter,
            number: this.currentNumber,
            block: this.currentBlock,
            delayedQueue: this.delayedQueue
        };
        await set(ref(db, 'queueState'), state);
    }

    formatNumber(num) {
        return num.toString().padStart(2, "0");
    }

    getCurrentQueue() {
        return `${this.letters[this.currentLetter]}${this.formatNumber(this.currentNumber + this.currentBlock * 10)}`;
    }

    async addToDelayedQueue(queueNumber) {
        if (!this.delayedQueue.includes(queueNumber)) {
            this.delayedQueue.push(queueNumber);
            await this.saveState();
        }
    }

    async removeFromDelayedQueue(queueNumber) {
        const index = this.delayedQueue.indexOf(queueNumber);
        if (index > -1) {
            this.delayedQueue.splice(index, 1);
            await this.saveState();
        }
    }

    getDelayedQueue() {
        return this.delayedQueue;
    }

    async next() {
        const previousState = {
            letter: this.currentLetter,
            number: this.currentNumber,
            block: this.currentBlock,
        };

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
        
        await this.saveState();
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

    async setCustomQueue(letter, number) {
        const letterIndex = this.letters.indexOf(letter);
        if (letterIndex === -1 || number < 1 || number > 50) {
            return false;
        }

        this.currentLetter = letterIndex;
        this.currentBlock = Math.floor((number - 1) / 10);
        this.currentNumber = ((number - 1) % 10) + 1;

        await this.saveState();
        return this.getCurrentQueue();
    }

    async reset() {
        this.currentLetter = 0;
        this.currentNumber = 1;
        this.currentBlock = 0;
        this.delayedQueue = [];
        await this.saveState();
        return this.getCurrentQueue();
    }

    // Add observer pattern for real-time updates
    setUpdateListener(callback) {
        this.updateListener = callback;
    }

    notifyListeners() {
        if (this.updateListener) {
            this.updateListener();
        }
    }
}