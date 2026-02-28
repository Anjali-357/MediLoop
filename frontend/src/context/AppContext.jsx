import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [currentPatient, setCurrentPatient] = useState({
        id: "64abc1234567890", // Mock ID
        name: "Riya Sharma",
        age: 5,
        language: "Hindi",
        phone: "+919876543210"
    });

    const [currentDoctor, setCurrentDoctor] = useState({
        id: "doc_001",
        name: "Dr. Smith"
    });

    const [authToken, setAuthToken] = useState("mock_jwt_token_for_hackathon");
    const [ws, setWs] = useState(null);

    useEffect(() => {
        // Note: Developer 2 owns the /api/recoverbot/ws/alerts endpoint
        // We instantiate it here so all modules can share it. For ScribeAI backend we don't need this specific general WS, 
        // but we adhere to the Shared Contract (Section 6.4 in PRD).
        const socket = new WebSocket('ws://localhost:8000/api/recoverbot/ws/alerts');

        socket.onopen = () => {
            console.log('Shared alert websocket connected');
        };

        socket.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                console.log("Shared WS Event Received:", event);
                // Handle global events if needed (like popup alerts)
            } catch (err) {
                console.error("Failed to parse WS message", e.data);
            }
        };

        setWs(socket);

        return () => {
            socket.close();
        };
    }, []);

    return (
        <AppContext.Provider value={{
            currentPatient,
            setCurrentPatient,
            currentDoctor,
            authToken,
            ws
        }}>
            {children}
        </AppContext.Provider>
    );
};
