<template>
  <div class="notifications-container">
    <div 
      v-for="(message, index) in messages" 
      :key="message.id"
      :class="['message', message.type]"
      :style="{ top: `${index * 60}px` }"
    >
      {{ message.text }}
    </div>
  </div>
  <Inventory />
</template>

<script>
import Inventory from './Inventory.vue'
import { EventBus } from './eventBus'
import { getSession, saveSession, isSessionActive } from '../services/sessionStorage'

export default {
  name: 'Main',
  components: {
    Inventory
  },
  data() {
    return {
      messages: [],
      messageIdCounter: 0
    }
  },
  created() {
    EventBus.on('message', this.displayMessage);

    // Extend session expiry if the app is being used
    this.extendSessionIfActive();
  },
  methods: {
    displayMessage(message) {
      // Add unique ID and timestamp to the message
      const messageWithId = {
        ...message,
        id: ++this.messageIdCounter,
        timestamp: Date.now()
      };
      
      // Add message to the queue
      this.messages.push(messageWithId);
      
      // Remove message after 2.5 seconds
      setTimeout(() => {
        this.removeMessage(messageWithId.id);
      }, 2500);
      
      // Limit to maximum 5 messages to prevent screen overflow
      if (this.messages.length > 5) {
        this.messages.shift(); // Remove oldest message
      }
    },
    
    removeMessage(messageId) {
      const index = this.messages.findIndex(msg => msg.id === messageId);
      if (index > -1) {
        this.messages.splice(index, 1);
      }
    },
    
    async extendSessionIfActive() {
      if (isSessionActive()) {
        try {
          // If session exists, extend its expiry time
          const currentSession = await getSession();
          if (currentSession) {
            await saveSession(currentSession);
          }
        } catch (error) {
          console.error('Error extending session:', error);
        }
      }
    }
  },
  beforeDestroy() {
    EventBus.off('message', this.displayMessage);
  }
}
</script>
<style scoped>
.notifications-container {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none; /* Allow clicks to pass through */
}

.message {
  position: absolute;
  padding: 12px 24px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  
  /* Smooth transitions for positioning and fade */
  transition: all 0.3s ease-in-out;
  animation: slideInFade 0.3s ease-out;
}

.message.error {
  background-color: #f44336;
  color: white;
  border-left: 4px solid #d32f2f;
}

.message.status {
  background-color: #4caf50;
  color: white;
  border-left: 4px solid #2e7d32;
}

.message.success {
  background-color: #4caf50;
  color: white;
  border-left: 4px solid #2e7d32;
}

.message.warning {
  background-color: #ff9800;
  color: white;
  border-left: 4px solid #f57c00;
}

.message.info {
  background-color: #2196f3;
  color: white;
  border-left: 4px solid #1976d2;
}


@keyframes slideInFade {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fadeOut {
  0%, 75% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
