/**
 * Interface for checkout operations
 */
export interface CheckoutOperations {
  /**
   * Creates a Shopify checkout URL with pre-filled customer information and cart items.
   */
  createUrl(params: {
    email: string;
    items: Array<{ productVariantId: string; quantity: string }>;
    address: {
      firstName: string;
      lastName: string;
      address1: string;
      city: string;
      zip: string;
      country: string;
      province: string;
      phone: string;
    };
  }): string;
}

/**
 * Creates checkout operations for a store instance
 */
export function createCheckoutOperations(baseUrl: string): CheckoutOperations {
  return {
    /**
     * Creates a Shopify checkout URL with pre-filled customer information and cart items.
     * 
     * @param params - Checkout parameters
     * @param params.email - Customer's email address (must be valid email format)
     * @param params.items - Array of products to add to cart
     * @param params.items[].productVariantId - Shopify product variant ID
     * @param params.items[].quantity - Quantity as string (must be positive number)
     * @param params.address - Customer's shipping address
     * @param params.address.firstName - Customer's first name
     * @param params.address.lastName - Customer's last name
     * @param params.address.address1 - Street address
     * @param params.address.city - City name
     * @param params.address.zip - Postal/ZIP code
     * @param params.address.country - Country name
     * @param params.address.province - State/Province name
     * @param params.address.phone - Phone number
     * 
     * @returns {string} Complete Shopify checkout URL with pre-filled information
     * 
     * @throws {Error} When email is invalid, items array is empty, or required address fields are missing
     * 
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * const checkoutUrl = await shop.checkout.create([
     *   { variantId: '123', quantity: 2 },
     *   { variantId: '456', quantity: 1 }
     * ]);
     * console.log(checkoutUrl);
     * ```
     */
    createUrl: ({
      email,
      items,
      address,
    }: {
      email: string;
      items: Array<{ productVariantId: string; quantity: string }>;
      address: {
        firstName: string;
        lastName: string;
        address1: string;
        city: string;
        zip: string;
        country: string;
        province: string;
        phone: string;
      };
    }) => {
      // Validate and sanitize inputs
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email address');
      }
      
      if (!items || items.length === 0) {
        throw new Error('Items array cannot be empty');
      }

      // Validate items
      for (const item of items) {
        if (!item.productVariantId || !item.quantity) {
          throw new Error('Each item must have productVariantId and quantity');
        }
        // Ensure quantity is a positive number
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantity must be a positive number');
        }
      }

      // Validate required address fields
      const requiredFields = ['firstName', 'lastName', 'address1', 'city', 'zip', 'country'];
      for (const field of requiredFields) {
        if (!address[field as keyof typeof address]) {
          throw new Error(`Address field '${field}' is required`);
        }
      }

      // Properly encode all URL parameters to prevent injection attacks
      const cartPath = items
        .map((item) => `${encodeURIComponent(item.productVariantId)}:${encodeURIComponent(item.quantity)}`)
        .join(",");

      const params = new URLSearchParams({
        'checkout[email]': email,
        'checkout[shipping_address][first_name]': address.firstName,
        'checkout[shipping_address][last_name]': address.lastName,
        'checkout[shipping_address][address1]': address.address1,
        'checkout[shipping_address][city]': address.city,
        'checkout[shipping_address][zip]': address.zip,
        'checkout[shipping_address][country]': address.country,
        'checkout[shipping_address][province]': address.province,
        'checkout[shipping_address][phone]': address.phone,
      });

      return `${baseUrl}cart/${cartPath}?${params.toString()}`;
    },
  };
}