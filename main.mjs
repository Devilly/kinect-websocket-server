import Kinect2 from 'kinect2';
const kinect = new Kinect2();

import { createServer } from 'http';

import sharp from 'sharp';
import { WebSocketServer, WebSocket } from 'ws';

const server = createServer();

function createWebSocketServer() {
    const wssServer = new WebSocketServer({ noServer: true });

    wssServer.on('connection', function connection(ws) {
        console.log('Connected!');
        ws.on('error', console.error);
    });

    wssServer.on('error', function (error) {
        console.log(error);
    });

    return wssServer;
}

const wssColor = createWebSocketServer(server);
const wssBody = createWebSocketServer(server);

server.on('upgrade', function (request, socket, head) {
    const { pathname: path } = new URL(request.url, 'wss://stubby.url');

    if (path === '/color') {
        wssColor.handleUpgrade(request, socket, head, function done(ws) {
            wssColor.emit('connection', ws, request);
        });
    } else if (path === '/body') {
        wssBody.handleUpgrade(request, socket, head, function done(ws) {
            wssBody.emit('connection', ws, request);
        });
    } else {
        console.log(`Destroy socket for request path: ${path}`)
        socket.destroy();
    }
});

server.listen(1337);

if (kinect.open()) {
    kinect.on('multiSourceFrame', async frame => {
        // HANDLE COLOR DATA
        const inputBuffer = Uint8Array.from(frame.color.buffer);
        const sharpImage = sharp(inputBuffer, {
            raw: {
                width: 1920,
                height: 1080,
                channels: 4
            }
        });

        // As it seems we can not cross the 65535 byte threshold (data is just not getting to my code in Godot),
        // we are lowering the quality of the image so that the number of bytes used is reduced to below the threshold.

        // Reference: https://github.com/godotengine/godot/issues/22496
        const outputBuffer = await sharpImage.jpeg({
            quality: 20
        }).toBuffer();

        wssColor.clients.forEach(async function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(outputBuffer);
            }
        });

        // HANDLE BODY DATA
        wssBody.clients.forEach(async function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    bodies: frame.body.bodies
                }));
            }
        });
    });

    kinect.openMultiSourceReader({
        frameTypes: Kinect2.FrameType.body | Kinect2.FrameType.color
    });
}
