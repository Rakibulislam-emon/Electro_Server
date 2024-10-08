const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Import jwt
const router = express.Router(); // Create a new router instance

// Registration Endpoint
router.post('/registration', async (req, res) => {
    try {
        const { registerInfos } = req.body; // Destructure registerInfos from the request body
        const { username, email, password, firstName, lastName, shopName, shopUrl, phoneNumber, userType } = registerInfos;

        // Validate Input
        if (!userType) {
            return res.status(400).json({ error: 'User type is required' });
        }

        // Validate fields based on user type
        if (userType === 'customer') {
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password are required for customers' });
            }
        } else if (userType === 'vendor') {
            if (!shopName || !shopUrl || !email || !password) {
                return res.status(400).json({ error: 'Shop name, shop URL, email, and password are required for vendors' });
            }
        }

        // Hash the Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user already exists
        const user = await req.usersCollection.findOne({ $or: [{ email: email }, { username: username }] });

        if (user) {
            console.error('User exists', user);
            return res.status(400).json({ error: 'User already exists' });
        }

        // Prepare user data
        const userData = {
            userType,
            email,
            password: hashedPassword,
        };

        if (userType === 'customer') {
            userData.username = username; // Add customer-specific fields
        } else if (userType === 'vendor') {
            userData.shopName = shopName; // Add vendor-specific fields
            userData.shopUrl = shopUrl;
            userData.firstName = firstName || null; // Optional for vendors
            userData.lastName = lastName || null; // Optional for vendors
            userData.phoneNumber = phoneNumber || null; // Optional for vendors
        }

        // Insert new user into the collection
        const result = await req.usersCollection.insertOne(userData);

        if (result.acknowledged) {
            // Create a JWT token
            const token = jwt.sign({  email, userType }, process.env.JWT_SECRET, { expiresIn: '7d' });

            // Send response with token
            res.status(201).json({ message: 'User registered successfully', token, userType });
        } else {
            res.status(400).json({ error: 'Failed to register user' });
        }

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; // Export the router
