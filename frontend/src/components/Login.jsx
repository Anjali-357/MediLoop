import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

export default function Login() {
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { setCurrentPatient, setCurrentDoctor } = useContext(AppContext);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!name || !age) {
            setError('Please enter both name and age.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const parsedAge = parseInt(age, 10);
            if (isNaN(parsedAge)) throw new Error("Age must be a number");

            const response = await fetch('http://localhost:8000/api/identity/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, age: parsedAge })
            });

            const data = await response.json();

            console.log("Login API Response:", data);

            if (response.ok && data.success) {
                setCurrentDoctor(data.doctor);
                setCurrentPatient(data.patient);
                navigate('/scribe');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            setError('Error connecting to Identity Service');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-surface-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-surface-200">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-600 tracking-tight">
                        Welcome to MediLoop
                    </h2>
                    <p className="mt-2 text-center text-sm text-surface-500">
                        Enter patient details to begin the consultation session
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="name" className="sr-only">Patient Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-surface-300 placeholder-surface-500 text-surface-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Patient Name (e.g. Riya Sharma)"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="age" className="sr-only">Age</label>
                            <input
                                id="age"
                                name="age"
                                type="number"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-surface-300 placeholder-surface-500 text-surface-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Age"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{error}</div>}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:bg-primary-300"
                        >
                            {loading ? 'Initializing Session...' : 'Start Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
