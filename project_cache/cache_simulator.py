import random

class CacheBlock:
    def __init__(self, block_size):
        self.valid = False
        self.tag = None
        self.data = [None] * block_size  # Initialize as None to distinguish from zero-initialized
        self.dirty = False
        self.last_access_time = 0  # For LRU replacement
        self.load_order = 0        # For FIFO replacement

class SetAssociativeCache:
    def __init__(self, cache_size, block_size, physical_memory_block_size, associativity=1, replacement_policy="LRU", address_width=8, access_time=1, memory_access_time=100):
        self.access_time = access_time  # Time to access this cache level
        self.memory_access_time = memory_access_time  # Main memory access time
        self.num_blocks = cache_size // block_size
        self.num_sets = 1 if associativity == self.num_blocks else self.num_blocks // associativity
        self.associativity = associativity
        self.replacement_policy = replacement_policy
        self.address_width = address_width
        self.physical_memory_block_size = physical_memory_block_size  # Fixed physical memory block size
        self.cache = [[CacheBlock(block_size) for _ in range(self.associativity)] for _ in range(self.num_sets)]
        self.block_size = block_size
        self.hits = 0
        self.misses = 0
        self.total_accesses = 0
        self.load_counter = 0
        self.memory = [random.randint(0, 1023) for _ in range(2 ** address_width)]
        # Metrics for AMAT calculation
        self.total_access_time = 0  # Total time for all memory accesses
        self.total_requests = 0  # Total number of requests

        # Add these:
        self.last_set_index = None  # Store the last accessed set index
        self.last_block_index = None  # Store the last accessed block index

    def index(self, address):
        return 0 if self.num_sets == 1 else (address // self.block_size) % self.num_sets

    def tag(self, address):
        return address // (self.num_sets * self.block_size)
    
    def get_miss_rate(self):
        if self.total_accesses == 0:
            return 0
        return self.misses / self.total_accesses
    
    def calculate_amat(self):
        """Calculate AMAT using the total access time and total requests."""
        if self.total_requests == 0:
            return "N/A"  # No requests to calculate AMAT
        return self.total_access_time / self.total_requests

    def get_stats(self):
        """Return statistics for this cache."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_accesses": self.total_accesses,
            "miss_rate": f"{self.get_miss_rate():.2%}",
            "access_time": self.access_time,
            "amat": self.calculate_amat()
        }

    def access(self, address, data=None):
        """Access the cache with the given address and optionally store data."""
        self.total_requests += 1  # Increment total requests
        set_index = self.index(address)
        tag = self.tag(address)
        block_offset = address % self.block_size
        set_blocks = self.cache[set_index]

        # Check for cache hit
        for i, block in enumerate(set_blocks):
            if block.valid and block.tag == tag:
                # Cache hit
                self.hits += 1
                self.total_access_time += self.access_time
                self.last_set_index = set_index  # Track accessed set index
                self.last_block_index = i  # Track accessed block index
                if data is not None:
                    block.data[block_offset] = data
                    block.dirty = True
                block.last_access_time = self.load_counter
                self.load_counter += 1
                return {"status": "hit", "data": block.data}
        # Cache miss
        self.misses += 1
        self.total_access_time += self.access_time
        self.load_counter += 1

        # Handle cache miss - find a block to replace
        block_to_replace = self.find_replacement_block(set_blocks)
        self.last_set_index = set_index
        self.last_block_index = set_blocks.index(block_to_replace) if block_to_replace else i
        self.byte_offset = block_offset

        # Load data from physical memory
        base_address = address - block_offset
        block_to_replace.data = self.memory[base_address:base_address + self.physical_memory_block_size]
        block_to_replace.data = block_to_replace.data[:self.block_size]  # Trim to cache block size
        block_to_replace.valid = True
        block_to_replace.tag = tag
        block_to_replace.last_access_time = self.load_counter
        block_to_replace.dirty = False

        # Write data if this is a write operation
        if data is not None:
            block_to_replace.data[block_offset] = data
            block_to_replace.dirty = True

        self.total_access_time += self.memory_access_time
        return {"status": "miss", "data": block_to_replace.data}
    def find_replacement_block(self, set_blocks):
        """Find a block to replace based on the replacement policy."""
        empty_block = next((blk for blk in set_blocks if not blk.valid), None)
        if empty_block:
            return empty_block
        if self.replacement_policy == "LRU":
            return min(set_blocks, key=lambda blk: blk.last_access_time)
        elif self.replacement_policy == "FIFO":
            return min(set_blocks, key=lambda blk: blk.load_order)
        elif self.replacement_policy == "Random":
            return random.choice(set_blocks)
        else:
            return set_blocks[0]

    def flush(self):
        """Reset all cache blocks and clear hit/miss counters."""
        for set_blocks in self.cache:
            for block in set_blocks:
                block.valid = False
                block.tag = None
                block.data = [None] * self.block_size  # Reset data to None
        self.hits = 0
        self.misses = 0
        self.total_accesses = 0
        self.load_counter = 0
        self.total_access_time = 0
        self.total_requests = 0

    def get_memory_block(self, start_address, size):
        """Fetch a block of memory starting from the given address."""
        return self.memory[start_address:start_address + self.physical_memory_block_size]
