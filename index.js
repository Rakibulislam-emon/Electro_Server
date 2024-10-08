const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken');
const registration = require('./registration.js')
const login = require('./login.js')



// Set the port for the server
const port = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors());


// authentication middleware



const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Assuming 'Bearer <token>'
    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user; // Save user info to request
        next(); // Proceed to the next middleware or route
    });
};


// Basic route to check server status
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// MongoDB URI setup
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.zuuvjs1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with MongoClientOptions
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect to MongoDB and specify collections
        const allProductsCollection = client.db('electroDB').collection('AllProducts');
        const shuffleCollection = client.db('electroDB').collection('shuffle');
        const topRatingsCollection = client.db('electroDB').collection('topRatings');
        const featuredCollection = client.db('electroDB').collection('featured');
        const onSellCollection = client.db('electroDB').collection('onSell');
        const bestSellsCollection = client.db('electroDB').collection('bestSells');
        const bestDealsCollection = client.db('electroDB').collection('bestDeals');
        const recentlyAddedCollection = client.db('electroDB').collection('recentlyAdded');
        const addToCartCollection = client.db('electroDB').collection('addToCart');
        // authentication collection
        const usersCollection = client.db('electroDB').collection('users');

        // * authentication

        // Use the auth routes for registration
        app.use('/api', (req, res, next) => {
            req.usersCollection = usersCollection; // Attach the usersCollection to the request object
            next(); // Call the next middleware
        }, registration);

        // Use the auth routes for login

        app.use('/login', (req, res, next) => {
            req.usersCollection = usersCollection; // Attach the usersCollection to the request object
            next(); // Call the next middleware
        }, login)




        //* All cart apis 
        //get related products single item by id
        app.get('/api/related_products/:id', async (req, res) => {
            try {

                const productId = new ObjectId(req.params.id);
                const collections = [
                    allProductsCollection,
                    shuffleCollection,
                    topRatingsCollection,
                    featuredCollection,
                    onSellCollection,
                    bestSellsCollection,
                    bestDealsCollection,
                    recentlyAddedCollection
                ]

                for (const collection of collections) {
                    const product = await collection.findOne({ _id: productId });
                    if (product) {
                        console.log('Product found:', product);
                        return res.json(product);
                    }
                }
                // If product is not found in any collection
                return res.status(404).json({ error: 'Product not found' });
               
            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // add to cart collection
        app.post('/api/cart/:id', authenticateToken, async (req, res) => {
            try {
                const product = req.body; // Product details from request body
                console.log('product:', product)
                const totalPrice = product.price * product.quantity; // Calculate total price
                product.totalPrice = totalPrice;
                // Post to cart collection
                const post = await addToCartCollection.insertOne(product);

                if (post) {
                    res.status(201).json({ message: 'Product added to cart successfully', post });
                } else {
                    res.status(400).json({ error: 'Failed to add product to cart' });
                }
            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Route to get all cart items for the authenticated user
        app.get('/api/cartItems', authenticateToken, async (req, res) => {
            try {
                // Extract email from the authenticated user (decoded token)
                const userEmail = req.user.email;

                // Fetch cart items for the logged-in user's email
                const cartItems = await addToCartCollection.find({ email: userEmail }).toArray();

                // Send the cart items as the response
                res.json(cartItems);
            } catch (error) {
                console.error('Error fetching cart items:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // update cart  items by id 
        app.patch('/api/cartUpdate/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedProduct = req.body;

                // Fetch the current item details to calculate the new total price
                const currentItem = await addToCartCollection.findOne({ _id: new ObjectId(id) });
                if (!currentItem) return res.status(404).send('No document found with this id');

                // Calculate new total price
                const newQuantity = updatedProduct.quantity;
                const newTotalPrice = currentItem.price * newQuantity; // Calculate new total price

                // Update the quantity and total price in the database
                const result = await addToCartCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            quantity: newQuantity, // Update the quantity
                            totalPrice: newTotalPrice // Update the total price
                        }
                    }
                );

                if (result.modifiedCount === 0) return res.status(404).send('No document found with this id');
                res.status(200).json({ message: 'Product updated successfully' });

            } catch (error) {
                console.log('error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // delete one cart item by id 
        app.delete('/api/cartRemove/:id', async (req, res) => {
            try {
                const id = req.params.id;
                console.log('id:', id)
                const result = await addToCartCollection.deleteOne({ _id: new ObjectId(id) });
                console.log(result, 'res');
                if (result.deletedCount === 0) return res.status(404).send('No document found with this id');
                res.status(200).json({ message: 'Product deleted successfully' });

            } catch (error) {
                console.log('error:', error)
                res.status(500).json({ error: 'Internal server error' });
            }
        })


        //* All get a routes
        // get products details by id
        app.get('/api/product/:id', async (req, res) => {
            try {
                const id = req.params.id;


                // Validate if the id is a valid ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send('Invalid product ID format');
                }

                const objectId = new ObjectId(id);

                // Array of collections to search in
                const collections = [
                    featuredCollection,
                    onSellCollection,
                    topRatingsCollection,
                    bestSellsCollection,
                    bestDealsCollection,
                    recentlyAddedCollection,
                    allProductsCollection,
                    shuffleCollection,
                    addToCartCollection,


                ];


                let product = null;

                // Iterate over each collection to search for the product
                for (const collection of collections) {
                    product = await collection.findOne({ _id: objectId });

                    if (product) {
                        // Product found - Extract the category
                        const productCategory = product?.category;

                        // Find all products in the same category from allProductsCollection
                        const categoryProducts = await allProductsCollection.find({ category: productCategory }).toArray();



                        // Return both the clicked product and other products in the same category
                        return res.json({
                            product, // The clicked product
                            relatedProducts: categoryProducts // All products in the same category
                        });
                    }
                }
                // If no product is found in any collection
                return res.status(404).send('Product not found');
            } catch (error) {
                console.error('Error fetching product:', error);
                res.status(500).send('Error fetching product');
            }
        });
        // filtered products 
        app.get('/api/products', async (req, res) => {
            try {
                console.log(req.query);

                const { category, brand, minPrice, maxPrice, availability, tags, warranty } = req.query;

                // Create an object for the primary filter
                const filter = {};

                // Add filters based on the request query
                if (category) filter.category = category;
                if (brand) filter.brand = brand;
                if (availability) filter.availability = availability;
                if (warranty) filter.warranty = warranty;

                // Add price range filter
                if (minPrice || maxPrice) {
                    filter.price = {};
                    if (minPrice) filter.price.$gte = Number(minPrice);
                    if (maxPrice) filter.price.$lte = Number(maxPrice);
                }

                // Add tags filter
                if (tags) {
                    const tagsArray = tags.split(',');
                    filter.tags = { $in: tagsArray };
                }

                // Fetch products based on primary filter conditions
                let matchedProducts = await allProductsCollection.find(filter).toArray();
                console.log('Matched Products:', matchedProducts);

                // If no matched products found, fetch similar products
                if (matchedProducts.length === 0) {
                    const similarFilter = {};

                    // Set similar category or brand filter for fallback
                    if (category) {
                        similarFilter.category = category;
                    } else if (brand) {
                        similarFilter.brand = brand;
                    }

                    // Include availability in the similar filter
                    if (availability) {
                        similarFilter.availability = availability;
                    }

                    // Reset price filter for a broader search
                    // Optional: Adjust price margins
                    similarFilter.price = {};
                    if (minPrice || maxPrice) {
                        if (minPrice) similarFilter.price.$lte = Number(minPrice) + 100; // Allow margin above minPrice
                        if (maxPrice) similarFilter.price.$gte = Number(maxPrice) - 100; // Allow margin below maxPrice
                    }

                    // Fetch similar products based on the fallback filter
                    matchedProducts = await allProductsCollection.find(similarFilter).toArray();
                    console.log('Similar Products:', matchedProducts);

                    // Optional: You can also send a message if no exact matches are found
                    if (matchedProducts.length > 0) {
                        res.json({ message: 'No exact matches found. Here are some similar products:', products: matchedProducts });
                    } else {
                        res.json({ message: 'No products found matching your criteria.' });
                    }
                } else {
                    res.json(matchedProducts); // Send the matched products as a response
                }
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ error: 'An error occurred while fetching products.' });
            }
        });

        // allProducts
        app.get('/api/allProducts', async (req, res) => {
            try {
                const products = await allProductsCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });




        app.get('/api/recently', async (req, res) => {
            try {
                const products = await recentlyAddedCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        // shuffleProducts
        app.get('/api/shuffleProducts', async (req, res) => {
            try {
                const products = await shuffleCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        // featuredProducts
        app.get('/api/featuredProducts', async (req, res) => {
            try {
                const products = await featuredCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        app.get('/api/onSaleProducts', async (req, res) => {
            try {
                const products = await onSellCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        app.get('/api/topRatedProducts', async (req, res) => {
            try {
                const products = await topRatingsCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        app.get('/api/bestDeals', async (req, res) => {
            try {
                const products = await bestDealsCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        app.get('/api/bestSells', async (req, res) => {
            try {
                const products = await bestSellsCollection.find().toArray();
                res.json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).send('Error fetching products');
            }
        });
        // get data by id recent time 
        app.get('/api/productById/:id', async (req, res) => {
            try {
                const id = req.params.id;

                // Validate if the id is a valid ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send('Invalid product ID format');
                }

                const objectId = new ObjectId(id);
                console.log('objectId:', objectId)

                const product = await recentlyAddedCollection.findOne({ _id: objectId });

                if (product) {
                    return res.json(product);
                } else {
                    return res.status(404).send('Product not found');
                }
            } catch (error) {
                console.error('Error fetching product:', error);
                res.status(500).send('Error fetching product');
            }
        });





        // // POST route to insert shuffled data into 'shuffleCollection'

        // app.post('/api/recentlyAdded', async (req, res) => {
        //     try {
        //         // Extract the shuffled data from the request body
        //         const shuffledData = req.body;

        //         // Remove the '_id' field from each object in the array
        //         const dataWithoutId = shuffledData.map(item => {
        //             const { _id, ...rest } = item;  // Use destructuring to exclude _id
        //             return rest;  // Return the object without the _id field
        //         });

        //         // Insert the modified data into the 'featuredCollection'
        //         const result = await recentlyAddedCollection.insertMany(dataWithoutId);

        //         // Send a success response back to the client
        //         res.send('inserted successfully');
        //         console.log('Data inserted successfully:', result.insertedCount);
        //     } catch (error) {
        //         console.error('Error inserting shuffled data:', error);
        //         res.status(500).send('An error occurred while inserting shuffled data');
        //     }
        // });


        // Ping the database to confirm connection
        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB!");

    } finally {
        // The connection will be automatically closed when the server shuts down
    }
}
run().catch(console.dir);

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
