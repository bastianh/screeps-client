<template>

  <div id="app">
    <table cellpadding="0" cellspacing="0" width="100%" height="100%">
      <tr height="0%"><td id="room-topbar">
        <span>Credits: {{money}}</span>
        <span>CPU: {{cpu}}</span>
        <span>Memory: {{memory}}</span>
        <select :value="roomName" @input="navigateToRoom($event.target.value)">
          <option v-for="roomName in rooms" :key="roomName" :value="roomName">
            {{ roomName }}
          </option>
        </select>
        <input id="room" :value="roomName" @change="navigateToRoom($event.target.value)" />
      </td></tr>
      <tr><td id="room-main-td">
        <div id="room-main">
          <split-pane @resize="onResize()">
            <div slot="left" style="height: 100%;">
              <div id="roomMaps">
                <room-map v-for="roomName in rooms" :key="roomName" :room-name="roomName" :api="api" @click="navigateToRoom(roomName)"></room-map>
              </div>
              <game :client="client"></game>
            </div>
            <div slot="right" style="height: 100%;">
              <split-pane-vertical>
                <div slot="left">&nbsp;</div>
                <console slot="right" :api="api"></console>
              </split-pane-vertical>
            </div>
          </split-pane>
        </div>
      </td></tr>
    </table>
  </div>

</template>

<script>

import SplitPane from './SplitPane.vue';
import SplitPaneVertical from './SplitPaneVertical.vue';
import Game from './Game.vue';
import Console from './Console.vue';
import RoomMap from './RoomMap.vue';
import eventBus from '../global-events';

export default {
  props: ['roomName'],
  data() {
    return {};
  },

  created() {
    this.setClientRoom();
  },

  watch: {
    'client': function(client) {
      console.log('watch client');
      this.setClientRoom();
    },

    'roomName': function(roomName) {
      console.log('watch roomName');
      this.setClientRoom();
    }
  },

  computed: {
    api() {
      return eventBus.api;
    },
    client() {
      return eventBus.client;
    },

    money() {
      return this.client && this.client.money || 0;
    },
    cpu() {
      return this.client && this.client.cpuMemory? this.client.cpuMemory.cpu : 0;
    },
    memory() {
      return this.client && this.client.cpuMemory? this.client.cpuMemory.memory : 0;
    },
    // roomName() {
    //   if (this.)
    //   return this.client && this.client.roomName || "";
    // },
    rooms() {
      return this.client && this.client.rooms || [];
    }
  },

  methods: {
    navigateToRoom(roomName) {
      this.$router.replace({name: 'room', params: {roomName}});
    },

    setClientRoom() {
      if (this.client) {
        if (this.roomName === "" && this.client.rooms) {
          this.navigateToRoom(this.client.rooms[0]);
        }
        this.client.setRoom(this.roomName);
      }
    },

    onResize() {
      eventBus.$emit('resize');
    }
  },

  components: { 
    Game,
    Console,
    SplitPane,
    SplitPaneVertical,
    RoomMap,
  },
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  height: 100%;
  position: relative;
}

#app {
  flex-direction: column;
  /*display: flex;*/
  margin: 0;
  padding: 0;
  min-height: 100%;
  height: 100%;
}

#app > table {
  height: 100%;
}

#topbar {
  /*height: 20px;*/
}

#room-main-td {
  position: relative;
  height: 100%;
}

#room-main {
  /*flex: 1;*/
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}

#roomMaps {
  flex-direction: row;
  display: flex;
  height: calc(150px + 1em + 4px + 1em); /* scrollbar */
  background: black;
  overflow-y: hidden;
  overflow-x: scroll;
}

</style>
