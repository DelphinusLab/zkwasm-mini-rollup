./target/release/csm_service --uri $URI &
cd ts && npm run docker-server

# Wait for any process to exit
wait -n

# Exit with status of the process that exited first
exit $?
~

