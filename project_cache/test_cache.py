# test_cache.py

from cache_simulator import DirectMappedCache

def main():
    # Initialize the cache with a size of 64 bytes and each block size of 16 bytes
    cache_size = 64
    block_size = 16
    cache = DirectMappedCache(cache_size, block_size)

    # Simulate memory accesses
    addresses = [0, 16, 32, 0, 48, 64, 80, 16]
    data_values = [10, 20, 30, 40, 50, 60, 70, 80]  # Example data to be stored

    for i, address in enumerate(addresses):
        print(f"Accessing address {address} with data {data_values[i]}...")
        cache.access(address, data=data_values[i])

if __name__ == "__main__":
    main()
