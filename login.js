const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Import jwt
const router = express.Router(); // Create a new router instance

// Login Endpoint
router.post('/', async (req, res) => {
    try {
        const { usersCollection } = req; // Destructure usersCollection from req
        const { email, password } = req.body; // Get email and password from request body

        // Validate Input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find the user by email
        const user = await usersCollection.findOne({ email: email });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare the password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, userType: user.userType }, // Payload
            process.env.JWT_SECRET, // Secret key
            { expiresIn: '7d' } // Token expiration time
        );

        // Login successful, return token and user data
        res.status(200).json({
            message: 'Login successful',
            token, // Include token in response
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType,
                // Add other user fields if needed
            }
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; // Export the router
