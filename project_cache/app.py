from flask import Flask, render_template, request, jsonify
from cache_simulator import SetAssociativeCache

app = Flask(__name__)
cache_system = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/configure', methods=['POST'])
def configure():
    global cache_system
    config = request.json
    print(f"Received configuration: {config}")  # Debug log

    address_width = config.get("address_width", 8)
    cache_size = config.get("cache_size")
    block_size = config.get("block_size")
    physical_memory_block_size = config.get("physical_memory_block_size", 8)  # Fixed block size for physical memory
    associativity = config.get("associativity")

    if associativity == 0:
        try:
            associativity = cache_size // block_size
        except ZeroDivisionError:
            return jsonify({"error": "Block size must be greater than zero."}), 400

    replacement_policy = config.get("replacement_policy", "LRU")

    # Validate inputs
    if not all([cache_size, block_size, associativity]):
        print("Error: Missing required configuration parameters.")  # Debug log
        return jsonify({"error": "Missing required configuration parameters"}), 400

    if cache_size % (block_size * associativity) != 0:
        print(f"Error: Invalid configuration. Cache size: {cache_size}, Block size: {block_size}, Associativity: {associativity}.")
        return jsonify({"error": "Invalid configuration. Cache size must be divisible by block size * associativity."}), 400

    # Check if cache size exceeds physical memory
    total_memory_size = 2 ** address_width  # Total size of physical memory
    if cache_size > total_memory_size:
        print(f"Error: Cache size ({cache_size} bytes) exceeds physical memory size ({total_memory_size} bytes).")
        return jsonify({"error": "Cache size cannot exceed physical memory size."}), 400

    # Check if block size exceeds total memory size
    if block_size > total_memory_size:
        print(f"Error: Block size ({block_size}) cannot exceed physical memory size ({total_memory_size}).")
        return jsonify({"error": "Block size cannot exceed physical memory size."}), 400

    try:
        cache_system = SetAssociativeCache(
            cache_size=cache_size,
            block_size=block_size,
            physical_memory_block_size=8,  # Physical memory block size remains fixed
            associativity=associativity,
            replacement_policy=replacement_policy,
            address_width=address_width,
        )
        print("Cache system successfully initialized.")  # Debug log
        return jsonify({"status": "Cache system configured successfully"})
    except Exception as e:
        print(f"Exception during cache configuration: {e}")  # Debug log
        return jsonify({"error": f"Failed to configure cache: {str(e)}"}), 500

@app.route('/access', methods=['POST'])
def access():
    global cache_system
    if cache_system is None:
        print("Access request failed: Cache system not configured.")  # Debug log
        return jsonify({"error": "Cache system not configured. Please configure the cache first."}), 400

    try:
        data = request.json
        print(f"Access request received: {data}")  # Debug log
        address = int(data['address'])
        value = data.get('value')  # Optional data for write operations

        result = cache_system.access(address, data=value)
        print(f"Access result: {result}")  # Debug log
        
        # Calculate the row index for physical memory highlighting
        aligned_block_size = cache_system.block_size
        physical_row_index = address // aligned_block_size

        return jsonify({
            "status": result["status"],
            "data": result["data"],
            "hits": cache_system.hits,
            "misses": cache_system.misses,
            "total_accesses": cache_system.total_accesses,
            "operation": "write" if value is not None else "read",
            "address": address,
            "value": value,
            "last_set_index": cache_system.last_set_index,
            "last_block_index": cache_system.last_block_index,
            "byte_offset": address % aligned_block_size,  # Byte offset within block
            "physical_row_index": physical_row_index  # Row index for physical memory
        })

    except Exception as e:
        print(f"Error during memory access: {e}")  # Debug log
        return jsonify({"error": f"Failed to access cache: {str(e)}"}), 500

@app.route('/flush', methods=['POST'])
def flush():
    global cache_system
    #if cache_system is None:
        #return jsonify({"error": "Cache system not configured. Please configure the cache first."}), 400

    try:
        cache_system = None  # Reset the cache system
        print("Cache system reset to None.")
        return jsonify({"status": "Cache completely reset."}), 200
    except Exception as e:
        print(f"Error during flush operation: {e}")
        return jsonify({"error": f"Failed to reset cache: {str(e)}"}), 500

@app.route('/stats', methods=['GET'])
def stats():
    global cache_system
    if cache_system is None:
        print("Stats request failed: Cache system not configured.")  # Debug log
        #return jsonify({"error": "Cache system not configured. Please configure the cache first."}), 400

    try:
        stats = cache_system.get_stats()
        print(f"Stats fetched: {stats}")  # Debug log
        return jsonify({
            "hits": stats["hits"],
            "misses": stats["misses"],
            "total_accesses": stats["total_accesses"],
            "miss_rate": stats["miss_rate"],
            "amat": stats["amat"]
        })
    except Exception as e:
        print(f"Error fetching stats: {e}")  # Debug log
        return jsonify({"error": f"Failed to fetch stats: {str(e)}"}), 500

@app.route('/cache_contents', methods=['GET'])
def cache_contents():
    global cache_system
    #if cache_system is None:
    #    return jsonify({"error": "Cache system not configured. Please configure the system first."}), 400
    # Check if cache exceeds memory size
    total_memory_size = 2 ** cache_system.address_width
    if cache_system.num_blocks * cache_system.block_size > total_memory_size:
        print("Error: Cache contents exceed the size of physical memory.")
        return jsonify({"error": "Cache contents exceed physical memory size."}), 400

    try:
        cache_view = [
            [
                {
                    "valid": block.valid,
                    "dirty": block.dirty,
                    "tag": block.tag,
                    "data": block.data if block.data else ["Empty"] * cache_system.block_size
                }
                for block in set_blocks
            ]
            for set_blocks in cache_system.cache
        ]
        print("Cache contents retrieved successfully.")
        return jsonify({
            "cache_contents": cache_view,
            "block_size": cache_system.block_size,
            "associativity": cache_system.associativity,
            "num_sets": cache_system.num_sets
        })
    except Exception as e:
        print(f"Error in /cache_contents: {e}")
        return jsonify({"error": f"Failed to fetch cache contents: {str(e)}"}), 500

@app.route('/physical_memory', methods=['GET'])
def physical_memory():
    global cache_system
    #if cache_system is None:
    #    return jsonify({"error": "Cache system not configured. Please configure the system first."}), 400

    try:
        aligned_block_size = 8  # Force alignment to 8 bytes
        address_width = cache_system.address_width
        memory_size = 2 ** address_width  # Total memory size in bytes

        # Number of blocks based on aligned block size
        num_blocks = memory_size // aligned_block_size

        memory_data = []
        for i in range(num_blocks):
            start_address = i * aligned_block_size
            block_data = cache_system.get_memory_block(start_address, aligned_block_size)
            memory_data.append({
                "address": hex(start_address),
                "data": block_data[:aligned_block_size]  # Use aligned_block_size (fixed at 8)
            })



        return jsonify(memory_data)
    except Exception as e:
        print(f"Error in /physical_memory: {e}")
        #return jsonify({"error": f"Failed to fetch physical memory: {str(e)}"}), 500

@app.route('/batch', methods=['POST'])
def batch_operations():
    global cache_system
    if cache_system is None:
        return jsonify({"error": "Cache system not configured. Please configure the cache first."}), 400

    try:
        operations = request.json.get('operations', [])
        results = []

        for operation in operations:
            op_type = operation.get('type', '').lower()
            address = operation.get('address')  # Address is passed as a string
            value = operation.get('value')

            # Parse the address and value
            try:
                address = int(address, 16)
                if value is not None:
                    value = int(value, 16)
            except (ValueError, TypeError):
                results.append({
                    "operation": operation,
                    "result": {"status": "error", "error": "Invalid address or value"}
                })
                continue

            # Perform the operation
            try:
                if op_type == 'read':
                    result = cache_system.access(address)
                elif op_type == 'write':
                    result = cache_system.access(address, data=value)
                results.append({
                    "operation": operation,
                    "result": {
                        "status": result["status"],
                        "last_set_index": cache_system.last_set_index,
                        "last_block_index": cache_system.last_block_index,
                        "byte_offset": address % cache_system.block_size
                    }
                })
            except Exception as e:
                results.append({
                    "operation": operation,
                    "result": {"status": "error", "error": str(e)}
                })

        return jsonify({"results": results})

    except Exception as e:
        print(f"Error processing batch: {e}")
        return jsonify({"error": f"Failed to process batch operations: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True)
