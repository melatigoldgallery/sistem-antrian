export class QueueManager {
    constructor() {this.letters = ["A", "B", "C", "D"];
        const savedState = localStorage.getItem("queueState");
        const savedDelayedQueue = localStorage.getItem("delayedQueue");
        if (savedState) {
          const state = JSON.parse(savedState);
          this.currentLetter = state.letter;
          this.currentNumber = state.number;
          this.currentBlock = state.block;
        } else {
          this.currentLetter = 0;
          this.currentNumber = 1;
          this.currentBlock = 0;
        }
        this.delayedQueue = savedDelayedQueue ? JSON.parse(savedDelayedQueue) : [];
      }

      formatNumber(num) {
        return num.toString().padStart(2, "0");
      }

      getCurrentQueue() {
        return `${this.letters[this.currentLetter]}${this.formatNumber(this.currentNumber + this.currentBlock * 10)}`;
      }

      saveState() {
        const state = {
          letter: this.currentLetter,
          number: this.currentNumber,
          block: this.currentBlock,
        };
        localStorage.setItem("queueState", JSON.stringify(state));
        localStorage.setItem("delayedQueue", JSON.stringify(this.delayedQueue));
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
        const previousState = {
          letter: this.currentLetter,
          number: this.currentNumber,
          block: this.currentBlock,
        };
        localStorage.setItem("previousQueueState", JSON.stringify(previousState));
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
        this.saveState();
        return this.getCurrentQueue();
      }
    }
        