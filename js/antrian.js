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
        try {
            const queueRef = ref(database, 'queue');
            const snapshot = await get(queueRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                this.currentLetter = data.currentLetter;
                this.currentNumber = data.currentNumber;
                this.delayedQueue = data.delayedQueue || [];
            } else {
                this.currentLetter = 0;
                this.currentNumber = 1;
                this.delayedQueue = [];
                await this.saveState();
            }
        } catch (error) {
            console.log('Initializing default values due to:', error.message);
            this.currentLetter = 0;
            this.currentNumber = 1;
            this.delayedQueue = [];
            await this.saveState();
        }
    }
    
    async initializeCustomerCount() {
        try {
            const snapshot = await get(this.customerRef);
            this.customerCount = snapshot.val() || 0;
            this.updateCustomerDisplay();
        } catch (error) {
            console.log('Initializing customer count to 0 due to:', error.message);
            this.customerCount = 0;
            this.updateCustomerDisplay();
        }
    }
    
      async incrementCustomer() {
        const snapshot = await get(this.customerRef);
        const currentCount = snapshot.val() || 0;
        const newCount = currentCount + 1;
        await set(this.customerRef, newCount);
        this.customerCount = newCount;
        this.updateCustomerDisplay();
      }
    
      async decrementCustomer() {
        const snapshot = await get(this.customerRef);
        const currentCount = snapshot.val() || 0;
        if (currentCount > 0) {
          const newCount = currentCount - 1;
          await set(this.customerRef, newCount);
          this.customerCount = newCount;
          this.updateCustomerDisplay();
        }
      }
    
      updateCustomerDisplay() {
        const customerCountDisplay = document.getElementById("customerCount");
        if (customerCountDisplay) {
          customerCountDisplay.textContent = this.customerCount;
        }
      }

    formatNumber(num) {
        return num.toString().padStart(2, "0");
    }

    getCurrentQueue() {
        const number = parseInt(this.currentNumber);
        return `${this.letters[this.currentLetter]}${this.formatNumber(number)}`;
    }
    saveState() {
        const queueRef = ref(database, 'queue');
        set(queueRef, {
            currentLetter: this.currentLetter,
            currentNumber: this.currentNumber,
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
        const currentNumber = parseInt(this.currentNumber);
        const nextNumber = currentNumber + 1;
        let nextLetter = this.currentLetter;
    
        if (nextNumber <= 50) {
            return `${this.letters[nextLetter]}${this.formatNumber(nextNumber)}`;
        } else {
            return `${this.letters[(nextLetter + 1) % this.letters.length]}${this.formatNumber(1)}`;
        }
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
        this.delayedQueue = [];
        this.saveState();
        return this.getCurrentQueue();
    }
}