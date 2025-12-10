'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]: any = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [limit] = useState(10); // Items per page

  useEffect(() => {
    if (accessToken) {
      fetchProducts();
    }
  }, [accessToken, currentPage]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/products`, {
        params: {
          page: currentPage,
          limit: limit,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setProducts(response.data.products);
      setTotalPages(response.data.pagination.totalPages);
      setTotalProducts(response.data.pagination.totalProducts);
      setError(null);
    } catch (err) {
      setError('Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(amount || 0);
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        <span className='ml-2 text-gray-600'>Loading user data...</span>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
            <svg
              className='w-8 h-8 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
          </div>
          <p className='text-lg text-gray-600'>
            Please log in to see this content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Zoho Products</h1>
          <p className='mt-2 text-gray-600'>View your Zoho products</p>
        </div>

        {/* Products Section */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
          <div className='px-6 py-4 border-b border-gray-200'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-gray-900'>Products</h2>
              <div className='text-sm text-gray-500'>
                {totalProducts} total products
              </div>
            </div>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
              <span className='ml-2 text-gray-600'>Loading products...</span>
            </div>
          ) : error ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <div className='w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
                  <svg
                    className='w-8 h-8 text-red-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                </div>
                <p className='text-red-600'>{error}</p>
                <button
                  onClick={fetchProducts}
                  className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
                  <svg
                    className='w-8 h-8 text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
                    />
                  </svg>
                </div>
                <p className='text-gray-600'>No products found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Products Table */}
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead className='bg-gray-50'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Product
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        SKU
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Price
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Stock
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className='bg-white divide-y divide-gray-200'>
                    {products.map((product: any, index) => (
                      <tr
                        key={product._id || index}
                        className='hover:bg-gray-50 transition-colors'
                      >
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center'>
                            <div className='flex-shrink-0 h-10 w-10'>
                              <div className='h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center'>
                                <span className='text-white font-medium text-sm'>
                                  {product.name
                                    ? product.name.charAt(0).toUpperCase()
                                    : 'P'}
                                </span>
                              </div>
                            </div>
                            <div className='ml-4'>
                              <div className='text-sm font-medium text-gray-900'>
                                {product.name || 'Unnamed Product'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='text-sm text-gray-900 font-mono'>
                            {product.sku || product.item_id || 'N/A'}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='text-sm font-medium text-gray-900'>
                            {formatCurrency(product.rate || product.price)}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='text-sm text-gray-900'>
                            {product.stock ? product.stock : 0}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.status === 'active' || product.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {product.status === 'active' || product.is_active
                              ? 'Active'
                              : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {
                  <div className='px-6 py-4 border-t border-gray-200'>
                    <div className='flex items-center justify-between'>
                      <div className='text-sm text-gray-500'>
                        Showing {(currentPage - 1) * limit + 1} to{' '}
                        {Math.min(currentPage * limit, totalProducts)} of{' '}
                        {totalProducts} products
                      </div>
                      <div className='flex items-center space-x-2'>
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        >
                          Previous
                        </button>

                        <div className='flex items-center space-x-1'>
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }

                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => handlePageChange(pageNum)}
                                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                    currentPage === pageNum
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            }
                          )}
                        </div>

                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
              {/* Pagination */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Page;
