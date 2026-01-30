-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 21, 2025 at 02:49 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hw11_dev`
--

CREATE DATABASE IF NOT EXISTS `hw11_dev`;
USE `hw11_dev`;

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_cars`
--

CREATE TABLE `hwv00_cars` (
  `carId` varchar(99) NOT NULL,
  `carAssets` varchar(99) NOT NULL,
  `carCategoryId` varchar(99) NOT NULL,
  `carTeam` int(1) NOT NULL DEFAULT 1,
  `carName` varchar(99) NOT NULL,
  `carLength` int(3) NOT NULL,
  `carHeight` int(99) NOT NULL,
  `carSpeed` int(99) NOT NULL,
  `carAcceleration` int(11) NOT NULL,
  `carValid` tinyint(1) NOT NULL DEFAULT 1,
  `carAmountWarehouse` int(99) NOT NULL DEFAULT 500,
  `carReserved` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_cars`
--

INSERT INTO `hwv00_cars` (`carId`, `carAssets`, `carCategoryId`, `carTeam`, `carName`, `carLength`, `carHeight`, `carSpeed`, `carAcceleration`, `carValid`, `carAmountWarehouse`, `carReserved`) VALUES
('1718387923858', 'HKG38', '1718387189652', 1, 'Batman Forever Batmobile', 0, 0, 0, 0, 1, 479, 0),
('1718389279978', 'HKG37', '1718387215782', 1, 'Brick and Motor', 0, 0, 0, 0, 1, 624, 0),
('1718389332478', 'HKH16', '1718387215782', 1, 'Custom Small Block', 0, 0, 0, 0, 1, 643, 0),
('1718389342025', 'HKH17', '1718387215782', 1, 'Bricking Speed', 0, 0, 0, 0, 1, 656, 0),
('1718389351647', 'HKG33', '1718387222425', 1, 'Hw Braille Racer - Twin Mill', 0, 0, 0, 0, 1, 636, 0),
('1718389364637', 'HKJ27', '1718387222425', 1, 'Gotta Go', 0, 0, 0, 0, 1, 620, 0),
('1718389373985', 'HKJ28', '1718387222425', 1, 'Clip Rod', 0, 0, 0, 0, 1, 620, 0),
('1718389385798', 'HKG30', '1718387215782', 1, 'BMW 507', 0, 0, 0, 0, 1, 620, 0),
('1718389397360', 'HKJ29', '1718387215782', 1, 'Lucid Air', 0, 0, 0, 0, 1, 620, 0),
('1718389418927', 'HKJ30', '1718387228737', 1, 'Lotus Emira', 0, 0, 0, 0, 1, 1107, 0),
('1718389438086', 'HKH67', '1718387236167', 1, 'Dodge Van', 0, 0, 0, 0, 1, 620, 0),
('1718389450675', 'HKH68', '1718387236167', 1, 'Erikenstein Rod', 0, 0, 0, 0, 1, 620, 0),
('1718389460856', 'HKH77', '1718387236167', 1, 'Turbine Sublime', 0, 0, 0, 0, 1, 620, 0),
('1718389470741', 'HKL00', '1718387236167', 1, 'Mod Rod', 0, 0, 0, 0, 1, 597, 1),
('1718389730323', 'HKH48', '1718387242543', 1, 'Custom 11 Camaro', 0, 0, 0, 0, 1, 620, 0),
('1718389738095', 'HKH49', '1718387242543', 1, '68 Copo Camaro', 0, 0, 0, 0, 1, 620, 0),
('1718389749574', 'HKH50', '1718387242543', 1, 'Hot Wheels Ford Transit Connect', 0, 0, 0, 0, 1, 740, 0),
('1718389759831', 'HKH51', '1718387242543', 1, '08 Ford Focus', 0, 0, 0, 0, 1, 615, 0),
('1718389770790', 'HKH52', '1718387242543', 1, '76 Greenwood Corvette', 0, 0, 0, 0, 1, 620, 0),
('1718389855964', 'HKH50', '1718387242543', 1, 'Ford Transit Connect', 0, 0, 0, 0, 1, 740, 0),
('1718389868022', 'HKH28', '1718387251063', 1, '18 Copo Camaro SS', 0, 0, 0, 0, 1, 620, 0),
('1718389877132', 'HKH29', '1718387251063', 1, 'Ford mustang Mach-E 1400', 0, 0, 0, 0, 1, 615, 0),
('1718390021222', 'HKH31', '1718387251063', 1, 'Lolux', 0, 0, 0, 0, 1, 620, 0),
('1718390032183', 'HKH32', '1718387251063', 1, '86 Ford Thunderbird Pro Stock', 0, 0, 0, 0, 1, 620, 0),
('1718390047284', 'HKG27', '1718387260807', 1, 'Volvo P1800 Gasser', 0, 0, 0, 0, 1, 620, 0),
('1718390059094', 'HKG39', '1718387260807', 1, 'El Segundo Coupe', 0, 0, 0, 0, 1, 620, 0),
('1718390068682', 'HKH21', '1718387260807', 1, 'Bone Shaker', 0, 0, 0, 0, 1, 620, 0),
('1718390079157', 'HKJ49', '1718387260807', 1, 'Rodger Dodger', 0, 0, 0, 0, 1, 620, 1),
('1718390095063', 'HKH61', '1718387271971', 1, '55 Chevy Bel Air Gasserr', 0, 0, 0, 0, 1, 610, 0),
('1718390111229', 'HKG28', '1718387278174', 1, 'Tesla Model Y', 0, 0, 0, 0, 1, 620, 0),
('1718390123670', 'HKG36', '1718387278174', 1, 'Rimac Nevera', 0, 0, 0, 0, 1, 620, 0),
('1718390134049', 'HKH55', '1718387278174', 1, 'Porsche Panamera Turbo S E-Hybrid Sport Turismo', 0, 0, 0, 0, 1, 620, 0),
('1718390144220', 'HKH56', '1718387278174', 1, 'Lotus Evija', 0, 0, 0, 0, 1, 620, 0),
('1718390154314', 'HKH57', '1718387278174', 1, 'Automobili Pininfarina Battista', 0, 0, 0, 0, 1, 560, 0),
('1718390165811', 'HKH85', '1718387278174', 1, 'Audi RS E-Tron GT', 0, 0, 0, 0, 1, 615, 0),
('1718390180413', 'HKJ00', '1718387286292', 1, 'GMC Hummer EV', 0, 0, 0, 0, 1, 620, 0),
('1718390193748', 'HKJ11', '1718387293101', 1, '2023 Nissan Z', 0, 0, 0, 0, 1, 620, 0),
('1718390208508', 'HKJ15', '1718387293101', 1, '1986 Toyota Van', 0, 0, 0, 0, 1, 620, 0),
('1718390218171', 'HKJ16', '1718387293101', 1, '90 Honda Civic EF', 0, 0, 0, 0, 1, 620, 0),
('1718390229793', 'HKL20', '1718387293101', 1, '1968 Mazda Cosmo Sport', 0, 0, 0, 0, 1, 620, 0),
('1718390241844', 'HKG89', '1718387300606', 1, 'Time Attaxi', 0, 0, 0, 0, 1, 620, 0),
('1718390254812', 'HKG91', '1718387300606', 1, 'Hot Wheels High', 0, 0, 0, 0, 1, 615, 0),
('1718390264125', 'HKG92', '1718387300606', 1, 'Dodge Charger Drift', 0, 0, 0, 0, 1, 620, 0),
('1718390275210', 'HKG93', '1718387300606', 1, 'Drone Duty', 0, 0, 0, 0, 1, 595, 0),
('1718390285611', 'HKH86', '1718387300606', 1, 'Nissan leaf Nismo RC_02', 0, 0, 0, 0, 1, 600, 0),
('1718390301300', 'HKH87', '1718387307358', 1, '15 Mazda Mx-5 Miata', 0, 0, 0, 0, 1, 601, 0),
('1718390316807', 'HKH40', '1718387313319', 1, 'McLaren Elva', 0, 0, 0, 0, 1, 600, 0),
('1718390331305', 'HKH41', '1718387313319', 1, 'Corvette C7 Z06 Convertible', 0, 0, 0, 0, 1, 594, 0),
('1718390346132', 'GRX17', '1718387320752', 1, 'Standard Kart', 0, 0, 0, 0, 1, 620, 0),
('1718390356581', 'HKH11', '1718387320752', 1, 'Barbie Extra', 0, 0, 0, 0, 1, 620, 0),
('1718390371770', 'HKH82', '1718387326601', 1, 'Ice Shredder', 0, 0, 0, 0, 1, 620, 0),
('1718390391507', 'HKG82', '1718387333173', 1, '80 El Camino', 0, 0, 0, 0, 1, 620, 0),
('1718390411164', 'HKG29', '1718387339799', 1, 'Rally Speciale', 0, 0, 0, 0, 1, 620, 0),
('1718390425498', 'HKG34', '1718387339799', 1, 'Group C fantasy', 0, 0, 0, 0, 1, 620, 0),
('1718390443395', 'HKG41', '1718387339799', 1, 'Rollin Solo', 0, 0, 0, 0, 1, 620, 0),
('1718390458723', 'HKH66', '1718387339799', 1, 'Hot Wired', 0, 0, 0, 0, 1, 620, 0),
('1718390474907', 'HKH78', '1718387339799', 1, 'Mach It Go', 0, 0, 0, 0, 1, 620, 0),
('1718390486787', 'HKJ36', '1718387345576', 1, 'Pagani Zonda R', 0, 0, 0, 0, 1, 620, 0),
('1718390501412', 'HKJ37', '1718387345576', 1, 'Astin martin vantage GTE', 0, 0, 0, 0, 1, 620, 0),
('1718390520595', 'HKG80', '1718387333173', 1, '84 Mustang SVO', 0, 0, 0, 0, 1, 620, 0),
('1718390532499', 'HKG81', '1718387333173', 1, '89 Mazda Savanna RX-7 FC3S', 0, 0, 0, 0, 1, 620, 0),
('1718390542746', 'HKG83', '1718387333173', 1, '84 Corvette', 0, 0, 0, 0, 1, 620, 0),
('1718390553540', 'HKG84', '1718387333173', 1, 'DMC Delorean', 0, 0, 0, 0, 1, 620, 0),
('1718390562373', 'HKG85', '1718387333173', 1, '82 Cadillac Seville', 0, 0, 0, 0, 1, 620, 0),
('1718390574426', 'HKH75', '1718387333173', 1, 'Chrysler Pacifica', 0, 0, 0, 0, 1, 740, 0),
('1718390596912', 'HKH75', '1718387375151', 1, 'Chrysler Pacifica ok', 0, 0, 0, 0, 1, 740, 0),
('1718390619819', 'HKH22', '1718387381405', 1, 'TwinDuction', 0, 0, 0, 0, 1, 620, 0),
('1718390630105', 'HKJ51', '1718387381405', 1, 'Count muscula', 0, 0, 0, 0, 1, 620, 0),
('1718390641793', 'HKJ53', '1718387381405', 1, 'Custom Ford Maverick', 0, 0, 0, 0, 1, 620, 0),
('1718390656290', 'HKJ55', '1718387381405', 1, '70 Dodge Hemi Challenger', 0, 0, 0, 0, 1, 620, 0),
('1718390666802', 'HKH01', '1718387381405', 1, 'Mazda 787B', 0, 0, 0, 0, 1, 740, 0),
('1718390685570', 'HKH02', '1718387388800', 1, 'Mercedes Benz 300 sl', 0, 0, 0, 0, 1, 620, 0),
('1718390698098', 'HKH01', '1718387388800', 1, 'Mazda 787B OKE', 0, 0, 0, 0, 1, 740, 0),
('1718390710148', 'HKH04', '1718387388800', 1, '32 Ford', 0, 0, 0, 0, 1, 620, 0),
('1718390736952', 'HKH05', '1718387388800', 1, 'Matt and Debbie Hay s 1988 Pro Street Thunderbird', 0, 0, 0, 0, 1, 620, 0),
('1718390770139', 'HKJ33', '1718387413726', 1, 'Kool Kombi', 0, 0, 0, 0, 1, 620, 0),
('1718390786379', 'HKJ35', '1718387413726', 1, 'Surf n Turf', 0, 0, 0, 0, 1, 620, 0),
('1718390796243', 'HKJ34', '1718387413726', 1, 'Deora 3', 0, 0, 0, 0, 1, 620, 0);

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_cassettes`
--

CREATE TABLE `hwv00_cassettes` (
  `casNr` int(3) NOT NULL,
  `casColumn` int(3) NOT NULL,
  `casRow` int(3) NOT NULL,
  `casValid` varchar(11) NOT NULL DEFAULT 'true',
  `casCarAssets` varchar(99) NOT NULL,
  `casCarAmount` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_cassettes`
--

INSERT INTO `hwv00_cassettes` (`casNr`, `casColumn`, `casRow`, `casValid`, `casCarAssets`, `casCarAmount`) VALUES
(0, 0, 0, '1', 'HKJ30', 8),
(1, 5, 1, '1', 'HKG38', 0),
(2, 6, 1, '1', 'HKG37', 0),
(3, 7, 1, '1', 'HKH16', 0),
(4, 8, 1, '1', 'HKH17', 8),
(5, 9, 1, '1', 'HKG33', 8),
(6, 4, 2, '1', 'HKJ27', 8),
(7, 5, 2, '1', 'HKJ28', 8),
(8, 6, 2, '1', 'HKG30', 8),
(9, 7, 2, '1', 'HKJ29', 8),
(10, 8, 2, '1', 'HKJ30', 8),
(11, 9, 2, '1', 'HKH67', 8),
(12, 10, 2, '1', 'HKH68', 8),
(13, 3, 3, '1', 'HKH77', 8),
(14, 4, 3, '1', 'HKL00', 8),
(15, 5, 3, '1', 'HKH48', 8),
(16, 6, 3, '1', 'HKH49', 8),
(17, 7, 3, '1', 'HKH50', 8),
(18, 8, 3, '1', 'HKH51', 8),
(19, 9, 3, '1', 'HKH52', 8),
(20, 10, 3, '1', 'HKH50', 8),
(21, 11, 3, '1', 'HKH28', 8),
(22, 3, 4, '1', 'HKH29', 8),
(23, 4, 4, '1', 'HKH31', 8),
(24, 5, 4, '1', 'HKH32', 8),
(25, 6, 4, '1', 'HKG27', 8),
(26, 7, 4, '1', 'HKG39', 8),
(27, 8, 4, '1', 'HKH21', 8),
(28, 9, 4, '1', 'HKJ49', 8),
(29, 10, 4, '1', 'HKH61', 8),
(30, 11, 4, '1', 'HKG28', 8),
(31, 3, 5, '1', 'HKG36', 8),
(32, 4, 5, '1', 'HKH55', 8),
(33, 5, 5, '1', 'HKH56', 8),
(34, 6, 5, '1', '', 8),
(35, 7, 5, '1', 'HKH85', 8),
(36, 8, 5, '1', 'HKJ00', 8),
(37, 9, 5, '1', 'HKJ11', 8),
(38, 10, 5, '1', 'HKJ15', 8),
(39, 11, 5, '1', 'HKJ16', 7),
(40, 4, 6, '1', 'HKL20', 7),
(41, 5, 6, '1', 'HKG89', 8),
(42, 6, 6, '1', 'HKG91', 8),
(43, 7, 6, '1', 'HKG92', 8),
(44, 8, 6, '1', 'HKG93', 8),
(45, 9, 6, '1', 'HKH86', 8),
(46, 10, 6, '1', 'HKH87', 8),
(47, 5, 7, '1', 'HKH40', 8),
(48, 6, 7, '1', 'HKH41', 8),
(49, 7, 7, '1', 'GRX17', 8),
(50, 8, 7, '1', 'HKH11', 8),
(51, 9, 7, '1', 'HKH82', 8),
(52, 5, 8, '1', 'HKG82', 8),
(53, 6, 8, '1', 'HKG29', 8),
(54, 7, 8, '1', 'HKG34', 8),
(55, 8, 8, '1', 'HKG41', 8),
(56, 9, 8, '1', 'HKH66', 8),
(57, 6, 9, '0', 'HKH78', 8),
(58, 8, 9, '0', 'HKJ36', 8),
(59, 1, 13, '1', 'HKJ37', 8),
(60, 2, 13, '1', 'HKG80', 8),
(61, 3, 13, '1', 'HKG81', 8),
(62, 11, 13, '1', 'HKG83', 8),
(63, 12, 13, '1', 'HKG84', 8),
(64, 13, 13, '1', 'HKG85', 8),
(65, 1, 14, '1', 'HKH75', 8),
(66, 2, 14, '1', 'HKH75', 8),
(67, 3, 14, '1', 'HKH22', 8),
(68, 4, 14, '1', 'HKJ51', 8),
(69, 10, 14, '1', 'HKJ53', 8),
(70, 11, 14, '1', 'HKJ55', 8),
(71, 12, 14, '1', 'HKH01', 8),
(72, 13, 14, '1', 'HKH02', 8),
(73, 1, 15, '1', 'HKH01', 8),
(74, 2, 15, '1', 'HKH04', 8),
(75, 3, 15, '1', 'HKH05', 8),
(76, 4, 15, '1', 'HKJ33', 8),
(77, 10, 15, '1', 'HKJ35', 8),
(78, 11, 15, '1', 'HKJ34', 8),
(79, 12, 15, '1', 'HKG38', 0),
(80, 13, 15, '1', 'HKG37', 0),
(81, 1, 16, '1', 'HKH16', 0),
(82, 2, 16, '1', 'HKH17', 8),
(83, 3, 16, '1', 'HKG33', 8),
(84, 4, 16, '1', 'HKJ27', 8),
(85, 10, 16, '1', 'HKJ28', 8),
(86, 11, 16, '1', 'HKG30', 8),
(87, 12, 16, '1', 'HKJ29', 8),
(88, 13, 16, '1', 'HKJ30', 8),
(89, 1, 17, '1', 'HKH67', 8),
(90, 2, 17, '1', 'HKH68', 8),
(91, 3, 17, '1', 'HKH77', 8),
(92, 4, 17, '1', 'HKL00', 8),
(93, 10, 17, '1', 'HKH48', 8),
(94, 11, 17, '1', 'HKH49', 8),
(95, 12, 17, '1', 'HKH50', 8),
(96, 13, 17, '1', 'HKH51', 8),
(97, 1, 18, '1', 'HKH52', 8),
(98, 2, 18, '1', 'HKH50', 7),
(99, 3, 18, '1', 'HKH28', 8),
(100, 4, 18, '1', 'HKH29', 8),
(101, 5, 18, '1', 'HKH31', 8),
(102, 9, 18, '1', 'HKH32', 8),
(103, 10, 18, '1', 'HKG27', 8),
(104, 11, 18, '1', 'HKG39', 8),
(105, 12, 18, '1', 'HKH21', 8),
(106, 13, 18, '1', 'HKJ49', 8),
(107, 1, 19, '1', 'HKH61', 8),
(108, 2, 19, '1', 'HKG28', 8),
(109, 3, 19, '1', 'HKG36', 8),
(110, 4, 19, '1', 'HKH55', 8),
(111, 5, 19, '1', 'HKH56', 8),
(112, 9, 19, '1', 'HKH57', 8),
(113, 10, 19, '1', 'HKH85', 8),
(114, 11, 19, '1', 'HKJ00', 8),
(115, 12, 19, '1', 'HKJ11', 8),
(116, 13, 19, '1', 'HKJ15', 8),
(117, 1, 20, '1', 'HKJ16', 8),
(118, 2, 20, '1', 'HKL20', 8),
(119, 3, 20, '1', 'HKG89', 8),
(120, 4, 20, '1', 'HKG91', 8),
(121, 5, 20, '1', 'HKG92', 8),
(122, 9, 20, '1', 'HKG93', 8),
(123, 10, 20, '1', 'HKH86', 8),
(124, 11, 20, '1', 'HKH87', 8),
(125, 12, 20, '1', 'HKH40', 8),
(126, 13, 20, '1', 'HKH41', 8),
(127, 2, 21, '1', 'GRX17', 8),
(128, 3, 21, '1', 'HKH11', 8),
(129, 4, 21, '1', 'HKH82', 8),
(130, 5, 21, '1', 'HKG82', 8),
(131, 9, 21, '1', 'HKG29', 8),
(132, 10, 21, '1', 'HKG34', 8),
(133, 11, 21, '1', 'HKG41', 8),
(134, 12, 21, '1', 'HKH66', 8),
(135, 2, 22, '1', 'HKH78', 8),
(136, 3, 22, '1', 'HKJ36', 8),
(137, 4, 22, '1', 'HKJ37', 8),
(138, 5, 22, '1', 'HKG80', 8),
(139, 9, 22, '1', 'HKG81', 8),
(140, 10, 22, '1', 'HKG83', 8),
(141, 11, 22, '1', 'HKG84', 8),
(142, 12, 22, '1', 'HKG85', 8),
(143, 2, 23, '1', 'HKH75', 8),
(144, 3, 23, '1', 'HKH75', 8),
(145, 4, 23, '1', 'HKH22', 8),
(146, 5, 23, '1', 'HKJ51', 8),
(147, 9, 23, '1', 'HKJ53', 8),
(148, 10, 23, '1', 'HKJ55', 8),
(149, 11, 23, '1', 'HKH01', 8),
(150, 12, 23, '1', 'HKH02', 8),
(151, 3, 24, '1', 'HKH01', 8),
(152, 4, 24, '1', 'HKH04', 8),
(153, 5, 24, '1', 'HKH05', 8),
(154, 9, 24, '1', 'HKJ33', 8),
(155, 10, 24, '1', 'HKJ35', 8),
(156, 11, 24, '1', 'HKJ34', 8),
(157, 3, 25, '1', 'HKG38', 0),
(158, 4, 25, '1', 'HKG37', 0),
(159, 10, 25, '1', 'HKH16', 0),
(160, 11, 25, '1', 'HKH17', 8),
(161, 4, 26, '1', 'HKG33', 8),
(162, 10, 26, '1', 'HKJ27', 20);

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_categories`
--

CREATE TABLE `hwv00_categories` (
  `categoryId` varchar(99) NOT NULL,
  `categoryName` varchar(99) NOT NULL,
  `categorySerie` varchar(99) NOT NULL,
  `categoryTeam` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_categories`
--

INSERT INTO `hwv00_categories` (`categoryId`, `categoryName`, `categorySerie`, `categoryTeam`) VALUES
('1718387189652', 'Batman', '', ''),
('1718387215782', 'Brick Rides', '', ''),
('1718387222425', 'Experimotors', '', ''),
('1718387228737', 'Factory Fresh', '', ''),
('1718387236167', 'Hw 55 Race Team', '', ''),
('1718387242543', 'Hw Art Cars', '', ''),
('1718387251063', 'Hw Drag Strip', '', ''),
('1718387260807', 'Hw Dream Garage', '', ''),
('1718387271971', 'Hw Gassers', '', ''),
('1718387278174', 'Hw Green Speed', '', ''),
('1718387286292', 'Hw Hot Trucks', '', ''),
('1718387293101', 'Hw J-Imports', '', ''),
('1718387300606', 'Hw Metro', '', ''),
('1718387307358', 'Hw Modified', '', ''),
('1718387313319', 'Hw Roadsters', '', ''),
('1718387320752', 'Hw Screen Time', '', ''),
('1718387326601', 'Hw Sports', '', ''),
('1718387333173', 'Hw the 80S', '', ''),
('1718387339799', 'Hw Track Champs', '', ''),
('1718387345576', 'Hw Turbo', '', ''),
('1718387375151', 'Mud Studs', '', ''),
('1718387381405', 'Muscle Mania', '', ''),
('1718387388800', 'Retro Racers', '', ''),
('1718387413726', 'Surf s Up', '', ''),
('1718387420406', 'Sweet Rides', '', ''),
('1719912271320', 'special rides', '', ''),
('1722592912886', 'testCategrory', '', '');

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_lang`
--

CREATE TABLE `hwv00_lang` (
  `UI_LANGUAGE` varchar(3) NOT NULL,
  `UI_SCAN_YOUR_QR` varchar(99) NOT NULL DEFAULT 'scan your QR',
  `UI_WELCOME` varchar(99) NOT NULL,
  `UI_ENTER_YOUR_NAME` varchar(99) NOT NULL DEFAULT 'enter your name',
  `UI_ENTER_YOUR_EMAIL` varchar(99) NOT NULL DEFAULT 'enter your email',
  `UI_SELECT_YOUR_CARS` varchar(99) NOT NULL DEFAULT 'select your cars',
  `UI_ADD_CAR` varchar(99) NOT NULL DEFAULT 'ADD',
  `UI_SELECTION_IS_MAX` varchar(99) NOT NULL DEFAULT 'selection is max',
  `UI_GO_BACK` varchar(99) NOT NULL DEFAULT 'go back',
  `UI_GO_NEXT` varchar(99) NOT NULL DEFAULT 'go next',
  `UI_YOUR_CARS` varchar(99) NOT NULL DEFAULT 'your cars',
  `UI_ARE_YOU_SURE` varchar(99) NOT NULL,
  `UI_PLACE_ORDER` varchar(99) NOT NULL,
  `UI_LETS_RACE` varchar(99) NOT NULL DEFAULT 'lets race!',
  `UI_SELECT_YOUR_TEAM` varchar(99) NOT NULL,
  `UI_ROBOT_IS_PICKING` varchar(99) NOT NULL,
  `UI_WATCH_THE_CUELINE` varchar(99) NOT NULL DEFAULT 'watch the cue line',
  `UI_YOUR_RACE_BEGINS` varchar(99) NOT NULL DEFAULT 'your race begins',
  `UI_YOUR_RACE_IS _FINISHED` varchar(99) NOT NULL DEFAULT 'your race is finished',
  `UI_CALL_OPERATOR` varchar(99) NOT NULL DEFAULT 'call an operator'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_lang`
--

INSERT INTO `hwv00_lang` (`UI_LANGUAGE`, `UI_SCAN_YOUR_QR`, `UI_WELCOME`, `UI_ENTER_YOUR_NAME`, `UI_ENTER_YOUR_EMAIL`, `UI_SELECT_YOUR_CARS`, `UI_ADD_CAR`, `UI_SELECTION_IS_MAX`, `UI_GO_BACK`, `UI_GO_NEXT`, `UI_YOUR_CARS`, `UI_ARE_YOU_SURE`, `UI_PLACE_ORDER`, `UI_LETS_RACE`, `UI_SELECT_YOUR_TEAM`, `UI_ROBOT_IS_PICKING`, `UI_WATCH_THE_CUELINE`, `UI_YOUR_RACE_BEGINS`, `UI_YOUR_RACE_IS _FINISHED`, `UI_CALL_OPERATOR`) VALUES
('', 'scan your QR', '', 'enter your name', 'enter your email', 'select your cars', 'ADD', 'you have all cars, proceed?', 'go back', 'go next', 'your cars', '', '', 'lets race!', '', '', 'watch the cue line', 'your race begins', 'your race is finished', 'call an operator'),
('ARB', 'مسح QR الخاص بك', 'مرحباً', 'أدخل اسمك', 'أدخل بريدك الإلكتروني', 'اختر سياراتك', 'يضيف', 'لقد قمت باختيار جميع السيارات', 'عُد', 'التالي', 'سياراتك', 'هل أنت متأكد؟', 'مكان النظام', 'يتيح السباق!', 'اختر فريقك', 'الروبوت يختار سياراتك الآن', 'مشاهدة خط جديلة', 'يبدأ سباقك', 'انتهى سباقك', 'اتصل بالمشغل'),
('ENG', 'scan your QR', 'welcome', 'enter your name', 'enter your email', 'select your cars', 'ADD', 'you have all cars complete', 'go back', 'next', 'your cars', 'are you sure', 'place order', 'lets race!', 'select your team', 'the robot picks your cars now', 'watch the cue line', 'your race begins', 'your race is finished', 'call an operator'),
('ESP', 'escanea tu QR', 'Bienvenido', 'tu nombre', 'tu correo electrónico', 'selecciona tus autos', 'agregar', 'Tienes todos los autos seleccionados', 'volver', 'próximo', 'tus autos', '¿está seguro?', 'hacer el pedido', '¡vamos a correr!', 'selecciona tu equipo', 'el robot está recogiendo', 'mira la línea de señal', 'tu carrera comienza', 'tu carrera ha terminado', 'Llamar a un operador'),
('GER', 'Scannen deine QR', 'Wilkommen', 'Gebe deinen Name ein', 'Gebe deine E-Mail-Adresse ein', 'Wählen deine Autos', 'zufugen', 'Du hast alle Autos ausgewählt', 'geh zurück', 'Weiter', 'deine Autos', 'Bist Du sicher', 'Bestellen bitte', 'Lasst uns Rennen!', 'Welches Team', 'Der Roboter sucht deine Autos', 'Gehe zum Leaderboard', 'Deine Race beginnt jetzt', 'Deine Race ist beendet', 'Rufe einen Operator');

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_machine`
--

CREATE TABLE `hwv00_machine` (
  `machineId` varchar(20) NOT NULL,
  `robotSerialNr` varchar(20) NOT NULL,
  `gripperType` varchar(10) NOT NULL DEFAULT 'modeBus',
  `gripperSerialNr` varchar(20) NOT NULL DEFAULT 'xxxxxxxx',
  `site_location` varchar(20) NOT NULL DEFAULT 'someCity',
  `nr_drops` int(11) NOT NULL DEFAULT 2,
  `nr_consoles` int(11) NOT NULL DEFAULT 2,
  `maxCarsPerOrder` int(2) NOT NULL DEFAULT 3,
  `maxAmountCarsInCassette` int(2) NOT NULL DEFAULT 8,
  `calibrationAngle` float NOT NULL DEFAULT 0.01
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_machine`
--

INSERT INTO `hwv00_machine` (`machineId`, `robotSerialNr`, `gripperType`, `gripperSerialNr`, `site_location`, `nr_drops`, `nr_consoles`, `maxCarsPerOrder`, `maxAmountCarsInCassette`, `calibrationAngle`) VALUES
('dev', '000000', 'modeBus', '000000', 'KSA_JAZAN', 2, 2, 3, 8, 0.25);

-- --------------------------------------------------------

--
-- Table structure for table `hwv00_orders`
--

CREATE TABLE `hwv00_orders` (
  `orderQr` varchar(21) NOT NULL,
  `orderStatus` varchar(20) NOT NULL,
  `orderCars` varchar(99) DEFAULT NULL,
  `orderUserName` varchar(99) NOT NULL,
  `orderUserEmail` varchar(99) NOT NULL,
  `orderTimeQrPrinted` varchar(30) NOT NULL,
  `orderTimeQrScanned` varchar(99) NOT NULL,
  `orderTimeCarsPicked` varchar(99) NOT NULL,
  `time_1` int(11) NOT NULL,
  `time_2` int(11) NOT NULL,
  `time_3` int(11) NOT NULL,
  `time_4` int(11) NOT NULL,
  `time_5` int(11) NOT NULL,
  `terminal_id` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hwv00_orders`
--

INSERT INTO `hwv00_orders` (`orderQr`, `orderStatus`, `orderCars`, `orderUserName`, `orderUserEmail`, `orderTimeQrPrinted`, `orderTimeQrScanned`, `orderTimeCarsPicked`, `time_1`, `time_2`, `time_3`, `time_4`, `time_5`, `terminal_id`) VALUES
('DEVX1763727000012_001', 'picked', '[HKG38,HKG37,HKH16]', 'lisa', 'lisa@mail.com', '', '2025-11-21 13:10:00.107', '', 0, 0, 0, 0, 0, '1'),
('DEVX1763727000014_002', 'picked', '[HKG38,HKG37,HKH16]', 'john', 'john@mail.com', '', '2025-11-21 13:10:00.108', '', 0, 0, 0, 0, 0, '2'),
('DEVX1763727000015_003', 'picked', '[HKG38,HKG37,HKH16]', 'nick', 'nick@mail.com', '', '2025-11-21 13:10:00.109', '', 0, 0, 0, 0, 0, '1'),
('DEVX1763727000017_004', 'picked', '[HKG38,HKG37,HKH16]', 'jamie', 'jamie@mail.com', '', '2025-11-21 13:10:00.110', '', 0, 0, 0, 0, 0, '2'),
('DEVX1763727000017_005', 'picked', '[HKG38,HKG37,HKH16]', 'william', 'william@mail.com', '', '2025-11-21 13:10:00.111', '', 0, 0, 0, 0, 0, '1'),
('DEVX1763727000018_006', 'picked', '[HKG38,HKG37,HKH16]', 'sandy', 'sandy@mail.com', '', '2025-11-21 13:10:00.112', '', 0, 0, 0, 0, 0, '2'),
('DEVX1763727000019_007', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000020_008', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000021_009', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000022_010', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000023_011', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000024_012', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000025_013', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000025_014', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000027_015', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000028_016', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000029_017', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000029_018', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000030_019', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('DEVX1763727000031_020', 'open', NULL, '', '', '', '', '', 0, 0, 0, 0, 0, ''),
('HWQR_________FREEPASS', 'picked', '[HKH50,HKJ16,HKL20]', 'asdsd', 'info@rays.nl', '', '2025-11-21 13:10:39.084', '', 0, 0, 0, 0, 0, '1');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `hwv00_cars`
--
ALTER TABLE `hwv00_cars`
  ADD UNIQUE KEY `carId` (`carId`);

--
-- Indexes for table `hwv00_cassettes`
--
ALTER TABLE `hwv00_cassettes`
  ADD UNIQUE KEY `casNr` (`casNr`);

--
-- Indexes for table `hwv00_categories`
--
ALTER TABLE `hwv00_categories`
  ADD UNIQUE KEY `categoryId` (`categoryId`);

--
-- Indexes for table `hwv00_lang`
--
ALTER TABLE `hwv00_lang`
  ADD UNIQUE KEY `UI_LANGUAGE` (`UI_LANGUAGE`);

--
-- Indexes for table `hwv00_machine`
--
ALTER TABLE `hwv00_machine`
  ADD UNIQUE KEY `machineId_2` (`machineId`),
  ADD KEY `machineId` (`machineId`);

--
-- Indexes for table `hwv00_orders`
--
ALTER TABLE `hwv00_orders`
  ADD PRIMARY KEY (`orderQr`),
  ADD UNIQUE KEY `orderQr_2` (`orderQr`),
  ADD KEY `orderQr` (`orderQr`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
