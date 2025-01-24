import { ref, push, set } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';

export class QueueAnalytics {
    constructor(database) {
        this.database = database;
    }

     async trackServedQueue(queueNumber, status = 'served') {
        const timestamp = new Date();
        const analyticsData = {
            queueNumber,
            status, // Track if queue was served normally or delayed
            timestamp: timestamp.toISOString(),
            hour: timestamp.getHours(),
            day: timestamp.getDay(),
            date: timestamp.getDate(),
            month: timestamp.getMonth() + 1,
            year: timestamp.getFullYear()
        };

        const analyticsRef = ref(this.database, `analytics/${timestamp.getFullYear()}/${timestamp.getMonth() + 1}/${timestamp.getDate()}`);
        const newDataRef = push(analyticsRef);
        await set(newDataRef, analyticsData);
    }
}
