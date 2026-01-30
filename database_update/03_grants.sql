-- Ensure application user can access both databases
GRANT ALL PRIVILEGES ON `hw11_2_jazan`.* TO 'hotwheels'@'%';
GRANT ALL PRIVILEGES ON `hw11_dev`.* TO 'hotwheels'@'%';
FLUSH PRIVILEGES;
