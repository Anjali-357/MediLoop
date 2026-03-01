import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [currentPatient, setCurrentPatient] = useState({
        _id: "demo_patient_1",
        id: "demo_patient_1",
        name: "Demo Patient",
        phone: "+910000000000",
        age: 30
    });
    const [currentDoctor, setCurrentDoctor] = useState({
        _id: "demo_doc_1",
        id: "demo_doc_1",
        name: "Dr. Smith"
    });

    const [authToken, setAuthToken] = useState("mock_jwt_token_for_hackathon");
    const [ws, setWs] = useState(null);
    const [alerts, setAlerts] = useState([]);

    const addAlert = (alert) => {
        const id = Date.now() + Math.random().toString();
        setAlerts(prev => [...prev, { ...alert, id }]);
    };

    const removeAlert = (id) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

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
                if (event.type === 'alert' || event.topic === 'recoverbot.flagged' || event.topic === 'commhub.emergency') {
                    addAlert({
                        title: event.topic === 'commhub.emergency' ? 'Emergency Request' : 'High Risk Flag',
                        message: event.data?.reason || event.data?.message || JSON.stringify(event.data),
                        patient_name: event.data?.patient_name || 'Patient',
                        risk: event.topic === 'commhub.emergency' ? 'CRITICAL' : 'HIGH',
                        suggested_action: event.data?.suggested_action || 'Review patient immediately in Control Center.'
                    });
                }
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
            setCurrentDoctor,
            authToken,
            ws,
            alerts,
            addAlert,
            removeAlert
        }}>
            {children}
        </AppContext.Provider>
    );
};
