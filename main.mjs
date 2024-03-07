import Kinect2 from 'kinect2';
const kinect = new Kinect2();

import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 1337 });

wss.on('connection', function connection(ws) {
    console.log('Connected!');
    ws.on('error', console.error);
});

wss.on('error', function(error) {
    console.log(error);
});

if (kinect.open()) {
    kinect.on('bodyFrame', bodyFrame => {
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(bodyFrame));
            }
        });
    });

    kinect.openBodyReader();
}
