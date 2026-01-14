import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

export function useMultiplayer() {
    const [peer, setPeer] = useState(null);
    const [myId, setMyId] = useState(null);
    const [conn, setConn] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
    const [receivedData, setReceivedData] = useState(null);

    // Initialize Peer
    useEffect(() => {
        const newPeer = new Peer();

        newPeer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            setMyId(id);
            setPeer(newPeer);
        });

        newPeer.on('connection', (connection) => {
            if (isHost) {
                console.log('Host received connection');
                setConn(connection);
                setConnectionStatus('connected');

                connection.on('data', (data) => {
                    setReceivedData(data);
                });

                connection.on('error', (err) => {
                    console.error('Host connection error:', err);
                    setConnectionStatus('disconnected');
                    setConn(null);
                });

                connection.on('close', () => {
                    console.log('Host connection closed');
                    setConnectionStatus('disconnected');
                    setConn(null);
                });
            }
        });

        newPeer.on('error', (err) => {
            console.error('Peer error:', err);
            setConnectionStatus('disconnected');
        });

        return () => {
            console.log('Destroying peer and cleaning up state');
            newPeer.destroy();
            setPeer(null);
            setMyId(null);
            setConn(null);
            setConnectionStatus('disconnected');
            setReceivedData(null);
        };
    }, [isHost]);

    const connectToPeer = useCallback((remoteId) => {
        if (!peer) return;

        console.log('Connecting to remote peer:', remoteId);
        setConnectionStatus('connecting');
        const connection = peer.connect(remoteId);

        connection.on('open', () => {
            console.log('Connection opened with host');
            setConn(connection);
            setConnectionStatus('connected');
            setIsHost(false);
        });

        connection.on('data', (data) => {
            setReceivedData(data);
        });

        connection.on('close', () => {
            setConnectionStatus('disconnected');
            setConn(null);
        });

        connection.on('error', (err) => {
            console.error('Connection error:', err);
            setConnectionStatus('disconnected');
        });
    }, [peer]);

    const sendData = useCallback((data) => {
        if (conn && conn.open) {
            conn.send(data);
        }
    }, [conn]);

    const disconnect = useCallback(() => {
        if (conn) {
            conn.close();
        }
        if (peer) {
            peer.destroy();
        }
        setConn(null);
        setPeer(null);
        setMyId(null);
        setConnectionStatus('disconnected');
        setReceivedData(null);
    }, [conn, peer]);

    return {
        myId,
        conn,
        isHost,
        setIsHost,
        connectionStatus,
        connectToPeer,
        sendData,
        receivedData,
        disconnect
    };
}
