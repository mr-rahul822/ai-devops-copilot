import time
import multiprocessing

def cpu_burner():
    """Infinite loop that consumes 100% of a single CPU core."""
    while True:
        pass

if __name__ == "__main__":
    print("[SIMULATOR] Starting High CPU usage simulation...")
    print("[SIMULATOR] Press Ctrl+C to stop.\n")

    # Start 4 processes to ensure overall CPU spikes high enough 
    # to trigger the >85% threshold, depending on how many cores the machine has.
    processes = []
    
    try:
        # Use up to 8 processors or the max available, to spike usage
        num_cores_to_burn = min(multiprocessing.cpu_count(), 8)
        print(f"[SIMULATOR] Burning {num_cores_to_burn} CPU cores. Wait a few minutes for the alert to trigger...")

        for _ in range(num_cores_to_burn):
            p = multiprocessing.Process(target=cpu_burner)
            p.start()
            processes.append(p)
            
        # Keep main thread alive
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[SIMULATOR] Stopping simulation...")
        for p in processes:
            p.terminate()
            p.join()
        print("[SIMULATOR] CPU load returning to normal.")
