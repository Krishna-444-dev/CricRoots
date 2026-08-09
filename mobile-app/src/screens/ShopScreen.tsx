import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Card, Button, Searchbar, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock data for shop items
const mockItems = [
  {
    id: '1',
    name: 'Professional Cricket Bat',
    price: 149.99,
    rating: 4.8,
    image: 'https://example.com/cricket-bat.jpg',
    category: 'Bats',
    inStock: true
  },
  {
    id: '2',
    name: 'Premium Cricket Ball Set',
    price: 29.99,
    rating: 4.5,
    image: 'https://example.com/cricket-balls.jpg',
    category: 'Balls',
    inStock: true
  },
  {
    id: '3',
    name: 'Batting Gloves',
    price: 34.99,
    rating: 4.7,
    image: 'https://example.com/batting-gloves.jpg',
    category: 'Protective Gear',
    inStock: true
  },
  {
    id: '4',
    name: 'Cricket Helmet',
    price: 79.99,
    rating: 4.9,
    image: 'https://example.com/cricket-helmet.jpg',
    category: 'Protective Gear',
    inStock: false
  },
  {
    id: '5',
    name: 'Cricket Shoes',
    price: 89.99,
    rating: 4.6,
    image: 'https://example.com/cricket-shoes.jpg',
    category: 'Footwear',
    inStock: true
  },
  {
    id: '6',
    name: 'Team Jersey',
    price: 49.99,
    rating: 4.4,
    image: 'https://example.com/team-jersey.jpg',
    category: 'Apparel',
    inStock: true
  }
];

// Categories for filtering
const categories = [
  'All',
  'Bats',
  'Balls',
  'Protective Gear',
  'Footwear',
  'Apparel',
  'Accessories'
];

const ShopScreen = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');

  const onChangeSearch = query => setSearchQuery(query);

  const filteredItems = mockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderItem = ({ item }) => (
    <Card style={styles.itemCard}>
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>Image</Text>
        </View>
      </View>
      <Card.Content>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemDetails}>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.starIcon}>★</Text>
          </View>
        </View>
        <View style={styles.stockContainer}>
          <Text style={item.inStock ? styles.inStock : styles.outOfStock}>
            {item.inStock ? 'In Stock' : 'Out of Stock'}
          </Text>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button 
          mode="contained" 
          style={styles.addToCartButton}
          disabled={!item.inStock}
        >
          Add to Cart
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CricSync Shop</Text>
        <Searchbar
          placeholder="Search equipment..."
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
        {categories.map(category => (
          <Chip
            key={category}
            selected={selectedCategory === category}
            onPress={() => setSelectedCategory(category)}
            style={styles.categoryChip}
            selectedColor="#1e88e5"
          >
            {category}
          </Chip>
        ))}
      </ScrollView>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        numColumns={2}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  categoriesContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryChip: {
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  listContainer: {
    padding: 8,
  },
  itemCard: {
    flex: 1,
    margin: 8,
    elevation: 2,
  },
  imageContainer: {
    alignItems: 'center',
    padding: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  imagePlaceholderText: {
    color: '#757575',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    height: 40, // Fixed height for two lines
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    marginRight: 2,
  },
  starIcon: {
    color: '#ffc107',
    fontSize: 12,
  },
  stockContainer: {
    marginBottom: 8,
  },
  inStock: {
    fontSize: 12,
    color: '#4caf50',
  },
  outOfStock: {
    fontSize: 12,
    color: '#f44336',
  },
  addToCartButton: {
    width: '100%',
    backgroundColor: '#1e88e5',
  },
});

export default ShopScreen;
